/**
 * Cryptographic utilities for Agent Garden:
 * - RSA-OAEP (2048-bit, SHA-256) + AES-256-GCM hybrid envelope encryption (`ag_env_v1:...`)
 *   for zero-knowledge agent communication tunnels of arbitrary length, with full
 *   backward compatibility for short single-block RSA-OAEP ciphertexts.
 * - RSA-PSS (2048-bit, SHA-256) payload signing & SHA-256 hashing.
 *
 * Works in both browsers (`window.crypto.subtle`) and Node.js 20+ (`globalThis.crypto.subtle`).
 */

const ENVELOPE_PREFIX = 'ag_env_v1:';
// Raw RSA-OAEP-2048 with SHA-256 fits up to 190 bytes; use single-block RSA up to 140 bytes
// so legacy RSA-only clients continue working on short messages, and hybrid AES-256-GCM above 140 bytes.
const MAX_RAW_RSA_BYTES = 140;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in this environment.');
  }
  return subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function generateAgentKeys() {
  const subtle = getSubtle();

  const encryptionKeyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const signingKeyPair = await subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const exportKey = async (key: CryptoKey, format: 'spki' | 'pkcs8') => {
    const buffer = (await subtle.exportKey(format, key)) as ArrayBuffer;
    return bytesToBase64(new Uint8Array(buffer));
  };

  return {
    publicKeyBase64: await exportKey(encryptionKeyPair.publicKey, 'spki'),
    privateKeyBase64: await exportKey(encryptionKeyPair.privateKey, 'pkcs8'),
    signingPublicKeyBase64: await exportKey(signingKeyPair.publicKey, 'spki'),
    signingPrivateKeyBase64: await exportKey(signingKeyPair.privateKey, 'pkcs8'),
  };
}

/**
 * Encrypts plaintext for an agent's RSA-2048 SPKI public key:
 * - Short messages (<= 140 UTF-8 bytes): raw RSA-OAEP-2048 (SHA-256) base64
 * - Longer messages (> 140 UTF-8 bytes): hybrid envelope `ag_env_v1:<rsaWrappedAesKeyB64>.<ivB64>.<aesGcmCiphertextB64>`
 */
export async function encryptForAgent(publicKeyBase64: string, text: string): Promise<string> {
  const subtle = getSubtle();
  const pubBytes = base64ToBytes(publicKeyBase64);

  const rsaPublicKey = await subtle.importKey(
    'spki',
    toArrayBuffer(pubBytes),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const encoded = new TextEncoder().encode(text);
  if (encoded.byteLength <= MAX_RAW_RSA_BYTES) {
    const encrypted = await subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, toArrayBuffer(encoded));
    return bytesToBase64(new Uint8Array(encrypted));
  }

  const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAesKey = new Uint8Array((await subtle.exportKey('raw', aesKey)) as ArrayBuffer);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const [wrappedKeyBuf, aesCipherBuf] = await Promise.all([
    subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, toArrayBuffer(rawAesKey)),
    subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, aesKey, toArrayBuffer(encoded)),
  ]);

  return `${ENVELOPE_PREFIX}${bytesToBase64(new Uint8Array(wrappedKeyBuf))}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(aesCipherBuf))}`;
}

/**
 * Decrypts either a legacy RSA-OAEP base64 ciphertext OR a hybrid `ag_env_v1:`
 * AES-256-GCM + RSA-OAEP envelope using the Agent's PKCS8 private key.
 */
export async function decryptFromAgent(privateKeyBase64: string, ciphertextPayload: string): Promise<string> {
  const subtle = getSubtle();
  const keyBytes = base64ToBytes(privateKeyBase64);

  const rsaPrivateKey = await subtle.importKey(
    'pkcs8',
    toArrayBuffer(keyBytes),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  const trimmed = ciphertextPayload.trim();
  if (trimmed.startsWith(ENVELOPE_PREFIX)) {
    const parts = trimmed.slice(ENVELOPE_PREFIX.length).split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed ag_env_v1 hybrid ciphertext envelope.');
    }
    const [wrappedKeyB64, ivB64, aesCipherB64] = parts;
    const rawAesKeyBuf = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      rsaPrivateKey,
      toArrayBuffer(base64ToBytes(wrappedKeyB64))
    );
    const aesKey = await subtle.importKey('raw', rawAesKeyBuf, { name: 'AES-GCM' }, false, ['decrypt']);
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(ivB64)) },
      aesKey,
      toArrayBuffer(base64ToBytes(aesCipherB64))
    );
    return new TextDecoder().decode(plainBuf);
  }

  const cipherBytes = base64ToBytes(trimmed);
  const decrypted = await subtle.decrypt({ name: 'RSA-OAEP' }, rsaPrivateKey, toArrayBuffer(cipherBytes));
  return new TextDecoder().decode(decrypted);
}

/**
 * Signs a payload using the Agent's signing private key (RSA-PSS, SHA-256).
 */
export async function signPayload(privateKeyBase64: string, payload: string): Promise<string> {
  const subtle = getSubtle();
  const keyBytes = base64ToBytes(privateKeyBase64);

  const privateKey = await subtle.importKey(
    'pkcs8',
    toArrayBuffer(keyBytes),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoded = new TextEncoder().encode(payload);
  const signature = await subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, privateKey, toArrayBuffer(encoded));
  return bytesToBase64(new Uint8Array(signature));
}

/**
 * Computes a SHA-256 hex digest of a payload for the ledger.
 */
export async function computeHash(payload: string): Promise<string> {
  const subtle = getSubtle();
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await subtle.digest('SHA-256', toArrayBuffer(msgUint8));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
