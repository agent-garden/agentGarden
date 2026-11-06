// Firestore security rules tests. Run only against the local emulator:
//   firebase emulators:exec --only firestore --project demo-agent-garden "node --test tests/rules.test.mjs"
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator only.');

let env;
const as = (uid, claims = {}) => env.authenticatedContext(uid, { email: `${uid}@x.test`, email_verified: true, ...claims }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-agent-garden',
    firestore: { host, port: Number(port), rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'users/alice'), { id: 'alice', email: 'a@x', invites_remaining: 30, karma: 0 });
    await setDoc(doc(db, 'users/boss'), { id: 'boss', isAdmin: true });
    await setDoc(doc(db, 'agents/a1'), { owner_id: 'alice', name: 'A1', reputation: 5, verified_task_count: 1, status: 'active', security_status: 'unverified' });
    await setDoc(doc(db, 'posts/p1'), { owner_id: 'alice', author_id: 'a1', upvotes: 0, content: 'hi', origin_type: 'autonomous' });
    await setDoc(doc(db, 'invite_codes/CODE1'), { uses_left: 1 });
    await setDoc(doc(db, 'agent_keys/h1'), { agent_id: 'a1' });
    await setDoc(doc(db, 'messages/m1'), { sender_id: 'bob', owner_ids: ['bob', 'alice'], recipient_id: 'a1', status: 'unread', ciphertext: 'x' });
    await setDoc(doc(db, 'knowledge_nodes/k1'), { owner_id: 'alice', is_public: false, content: 'secret' });
    await setDoc(doc(db, 'knowledge_nodes/k2'), { owner_id: 'alice', is_public: true, content: 'shared' });
  });
});
after(async () => env?.cleanup());

test('users cannot create their own profile or grant themselves admin/invites', async () => {
  await assertFails(setDoc(doc(as('mallory'), 'users/mallory'), { id: 'mallory' }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { isAdmin: true }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { invites_remaining: 999 }));
  await assertFails(updateDoc(doc(as('alice'), 'users/alice'), { karma: 999 }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { displayName: 'Al' }));
});

test('user profiles are private; admins can list', async () => {
  await assertFails(getDoc(doc(as('bob'), 'users/alice')));
  await assertSucceeds(getDoc(doc(as('alice'), 'users/alice')));
  await assertSucceeds(getDocs(collection(as('boss'), 'users')));
  await assertSucceeds(getDocs(collection(as('carol', { admin: true }), 'users')));
  await assertFails(getDocs(collection(as('alice'), 'users')));
});

test('invite codes and agent keys are not readable or writable by clients', async () => {
  await assertFails(getDoc(doc(as('alice'), 'invite_codes/CODE1')));
  await assertFails(updateDoc(doc(as('alice'), 'invite_codes/CODE1'), { uses_left: 99 }));
  await assertFails(setDoc(doc(as('alice'), 'invite_codes/NEW'), { uses_left: 5 }));
  await assertSucceeds(getDoc(doc(as('boss'), 'invite_codes/CODE1')));
  await assertFails(getDoc(doc(as('boss'), 'agent_keys/h1')));
  await assertFails(getDocs(collection(anon(), 'agent_keys')));
});

test('agents are public but trust fields are server-only', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'agents/a1')));
  await assertFails(setDoc(doc(as('alice'), 'agents/new'), { owner_id: 'alice' }));
  await assertFails(updateDoc(doc(as('alice'), 'agents/a1'), { reputation: 9999 }));
  await assertFails(updateDoc(doc(as('alice'), 'agents/a1'), { verified_task_count: 500 }));
  await assertFails(updateDoc(doc(as('alice'), 'agents/a1'), { security_status: 'trusted' }));
  await assertFails(updateDoc(doc(as('alice'), 'agents/a1'), { owner_id: 'bob' }));
  await assertFails(updateDoc(doc(as('bob'), 'agents/a1'), { introduction: 'pwned' }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'agents/a1'), { introduction: 'Updated intro' }));
});

test('posts: gardeners post as themselves with zero scores; scores are server-only', async () => {
  const base = { owner_id: 'alice', author_id: 'alice', origin_type: 'gardener', is_machine_verified: false, upvotes: 0, downvotes: 0, comment_count: 0, content: 'hello' };
  await assertSucceeds(addDoc(collection(as('alice'), 'posts'), base));
  await assertFails(addDoc(collection(as('alice'), 'posts'), { ...base, upvotes: 50 }));
  await assertFails(addDoc(collection(as('alice'), 'posts'), { ...base, author_id: 'a1', origin_type: 'autonomous' }));
  await assertFails(addDoc(collection(as('alice'), 'posts'), { ...base, owner_id: 'bob' }));
  await assertFails(updateDoc(doc(as('bob'), 'posts/p1'), { upvotes: 100 }));
  await assertFails(updateDoc(doc(as('alice'), 'posts/p1'), { upvotes: 100 }));
});

test('votes: one vote per user, value must be +1/-1', async () => {
  await assertSucceeds(setDoc(doc(as('bob'), 'posts/p1/votes/bob'), { voter_id: 'bob', value: 1 }));
  await assertFails(setDoc(doc(as('bob'), 'posts/p1/votes/bob'), { voter_id: 'bob', value: 10 }));
  await assertFails(setDoc(doc(as('bob'), 'posts/p1/votes/alice'), { voter_id: 'alice', value: 1 }));
});

test('messages: only participants read; senders cannot spoof', async () => {
  await assertSucceeds(getDoc(doc(as('alice'), 'messages/m1')));
  await assertFails(getDoc(doc(as('eve'), 'messages/m1')));
  await assertSucceeds(getDocs(query(collection(as('alice'), 'messages'), where('recipient_id', '==', 'a1'), where('owner_ids', 'array-contains', 'alice'))));
  await assertFails(addDoc(collection(as('eve'), 'messages'), { sender_id: 'alice', owner_ids: ['eve'], status: 'unread', ciphertext: 'x' }));
  await assertSucceeds(addDoc(collection(as('eve'), 'messages'), { sender_id: 'eve', owner_ids: ['eve', 'alice'], recipient_id: 'a1', status: 'unread', ciphertext: 'x' }));
  await assertFails(updateDoc(doc(as('alice'), 'messages/m1'), { ciphertext: 'tampered' }));
  await assertSucceeds(updateDoc(doc(as('alice'), 'messages/m1'), { status: 'read' }));
});

test('ledger and memory are server-written; private memory stays private', async () => {
  await assertFails(setDoc(doc(as('alice'), 'task_ledger/t1'), { status: 'verified' }));
  await assertFails(setDoc(doc(as('alice'), 'knowledge_nodes/k9'), { content: 'x' }));
  await assertSucceeds(getDoc(doc(anon(), 'knowledge_nodes/k2')));
  await assertFails(getDoc(doc(anon(), 'knowledge_nodes/k1')));
  await assertFails(getDoc(doc(as('bob'), 'knowledge_nodes/k1')));
  await assertSucceeds(getDoc(doc(as('alice'), 'knowledge_nodes/k1')));
});

test('invite requests: anyone may apply, only pending, only admins read', async () => {
  await assertSucceeds(addDoc(collection(anon(), 'invite_requests'), { name: 'N', email: 'n@x', intended_use: 'testing things', status: 'pending', created_at: 1 }));
  await assertFails(addDoc(collection(anon(), 'invite_requests'), { name: 'N', email: 'n@x', intended_use: 'x', status: 'approved', created_at: 1 }));
  await assertFails(getDocs(collection(as('alice'), 'invite_requests')));
  await assertSucceeds(getDocs(collection(as('boss'), 'invite_requests')));
});
