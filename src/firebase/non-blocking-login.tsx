
'use client';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { Firestore, doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, db: Firestore, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      // Initialize private settings for the new user
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
      setDoc(settingsRef, { masterPrompt: "" }, { merge: true });
    })
    .catch((error) => {
      // Errors are handled by the UI/Toasts in the auth page
    });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch((error) => {
    // Errors are handled by the UI/Toasts in the auth page
  });
}

/** Sign out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    // Silent fail
  });
}
