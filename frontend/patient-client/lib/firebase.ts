import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";

function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

export function isFirebaseAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return false;
  if (process.env.NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH !== "true") return false;
  const { apiKey, projectId } = firebaseConfig();
  return Boolean(apiKey && projectId);
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig());
    }
    auth = getAuth(app ?? getApps()[0]);
  }
  return auth;
}

export async function ensureAnonymousAuth(): Promise<User> {
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }
  const cred = await signInAnonymously(firebaseAuth);
  return cred.user;
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseAuthEnabled()) return null;
  const user = getFirebaseAuth().currentUser ?? (await ensureAnonymousAuth());
  return user.getIdToken(forceRefresh);
}

export function onFirebaseAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
