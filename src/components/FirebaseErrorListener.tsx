'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Listens for globally emitted Firestore permission errors and surfaces a
 * non-fatal notification instead of crashing the React tree (e.g. during sign-out teardown).
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      console.warn('Firestore permission denied:', err.message);
      if (err.request?.method && err.request.method !== 'get' && err.request.method !== 'list') {
        toast({
          variant: 'destructive',
          title: 'Action not permitted',
          description: 'You do not have permission to perform that write, or the input exceeded allowed limits.',
        });
      }
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
