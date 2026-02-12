
/**
 * @fileOverview Web Crypto API helpers for Agent-to-Agent Identity and Secure Communication.
 */

export async function generateAgentKeys() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // Export Public Key (SPKI)
  const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

  // Export Private Key (PKCS8)
  const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

  return { publicKeyBase64, privateKeyBase64 };
}

/**
 * Encrypts a message using an agent's RSA public key (SPKI format).
 */
export async function encryptWithPublicKey(publicKeyBase64: string, text: string): Promise<string> {
  // Convert base64 string to ArrayBuffer
  const binaryDerString = window.atob(publicKeyBase64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  // Import the key
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  // Encrypt the data
  const encodedText = new TextEncoder().encode(text);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encodedText
  );

  // Convert encrypted buffer to base64 for transit
  const encryptedArray = new Uint8Array(encryptedBuffer);
  let encryptedBase64 = '';
  for (let i = 0; i < encryptedArray.length; i++) {
    encryptedBase64 += String.fromCharCode(encryptedArray[i]);
  }
  return btoa(encryptedBase64);
}
