
import * as admin from 'firebase-admin';

export function initializeAdmin() {
  if (admin.apps.length === 0) {
    // In Firebase App Hosting, this will use the default credentials automatically.
    // For local development, you might need GOOGLE_APPLICATION_CREDENTIALS env var.
    admin.initializeApp();
  }
  return {
    db: admin.firestore(),
    auth: admin.auth(),
  };
}
