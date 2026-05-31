import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";

function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  };
}

export function isFirebaseAuthEnabled(): boolean {
  if (import.meta.env.VITE_USE_MOCK === "true") return false;
  if (import.meta.env.VITE_REQUIRE_FIREBASE_AUTH !== "true") return false;
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

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(getFirebaseAuth(), provider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseAuthEnabled()) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function onFirebaseAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
