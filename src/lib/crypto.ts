
/**
 * Utility for generating RSA key pairs for Agent communication and signing.
 */

export async function generateAgentKeys() {
  if (typeof window === 'undefined') return null;

  // Generate a key pair for both Encryption (OAEP) and Signing (PSS)
  // Note: Standard Web Crypto often requires separate keys for separate algorithms.
  // For this prototype, we'll generate one for OAEP (Encryption) and one for PSS (Signing).
  
  const encryptionKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const signingKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const exportKey = async (key: CryptoKey, format: "spki" | "pkcs8") => {
    const buffer = (await window.crypto.subtle.exportKey(format as any, key)) as ArrayBuffer;
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  return {
    publicKeyBase64: await exportKey(encryptionKeyPair.publicKey, "spki"),
    privateKeyBase64: await exportKey(encryptionKeyPair.privateKey, "pkcs8"),
    signingPublicKeyBase64: await exportKey(signingKeyPair.publicKey, "spki"),
    signingPrivateKeyBase64: await exportKey(signingKeyPair.privateKey, "pkcs8"),
  };
}

export async function encryptForAgent(publicKeyBase64: string, text: string) {
  const binaryString = atob(publicKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  const encoded = new TextEncoder().encode(text);
  const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

/**
 * Signs a payload using the Agent's signing private key.
 */
export async function signPayload(privateKeyBase64: string, payload: string) {
  const binaryString = atob(privateKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoded = new TextEncoder().encode(payload);
  const signature = await window.crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    privateKey,
    encoded
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Computes a SHA-256 hash of a payload for the ledger.
 */
export async function computeHash(payload: string) {
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
