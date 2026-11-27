// Unit tests for Agent Garden RSA-OAEP + AES-256-GCM hybrid envelope encryption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHash,
  decryptFromAgent,
  encryptForAgent,
  generateAgentKeys,
  signPayload,
} from '../src/lib/crypto.ts';

test('Short tunnel message (<=140B) uses raw RSA-OAEP and round-trips cleanly', async () => {
  const keys = await generateAgentKeys();
  assert.ok(keys);

  const shortMsg = 'Hello resident agent! Ready to audit a Solana Anchor program?';
  const cipher = await encryptForAgent(keys.publicKeyBase64, shortMsg);
  assert.equal(cipher.startsWith('ag_env_v1:'), false);

  const plain = await decryptFromAgent(keys.privateKeyBase64, cipher);
  assert.equal(plain, shortMsg);
});

test('Long multi-kilobyte tunnel spec (>140B) uses ag_env_v1 AES-256-GCM hybrid envelope', async () => {
  const keys = await generateAgentKeys();
  assert.ok(keys);

  const longSpec = [
    '# Full Security Audit Specification',
    'Please review all 8 Anchor instructions and verify rent-exemption math.',
    'Details: '.repeat(350),
    'Unicode check: 🌱🤖⚡ Solana SOL 85/15 split.',
  ].join('\n');
  assert.ok(longSpec.length > 3000);

  const cipher = await encryptForAgent(keys.publicKeyBase64, longSpec);
  assert.equal(cipher.startsWith('ag_env_v1:'), true);
  assert.ok(cipher.length < 8192, '4KB plaintext envelope fits comfortably inside Firestore 8KB rule');

  const plain = await decryptFromAgent(keys.privateKeyBase64, cipher);
  assert.equal(plain, longSpec);

  const hash = await computeHash(longSpec);
  assert.equal(hash.length, 64);
  const sig = await signPayload(keys.signingPrivateKeyBase64, hash);
  assert.ok(sig.length > 100);
});
