import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  isFirebaseAuthEnabled,
  onFirebaseAuthChange,
  signInWithGoogle,
  signOutFirebase,
} from "../lib/firebase";
import { registerNurseSession } from "../lib/auth-fetch";

interface NurseAuthGateProps {
  children: ReactNode;
}

export function NurseAuthGate({ children }: NurseAuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!isFirebaseAuthEnabled());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseAuthEnabled()) return;
    return onFirebaseAuthChange((next) => {
      setUser(next);
      setReady(true);
      if (next) {
        void registerNurseSession().catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to register nurse session");
        });
      }
    });
  }, []);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      await registerNurseSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOutFirebase();
  }

  if (!isFirebaseAuthEnabled()) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            ER-OVERWATCH
          </p>
          <h1 className="mt-2 text-2xl font-bold">Nurse Command</h1>
          <p className="mt-3 text-sm text-slate-400">
            Sign in with your Google account to access the triage dashboard.
          </p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in with Google"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div
        className="flex items-center justify-end gap-3 border-b border-slate-800 px-4 py-1.5 text-xs text-slate-500"
        style={{ background: "#0f172a" }}
      >
        <span>{user.email ?? user.displayName ?? "Nurse"}</span>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-slate-400 underline hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
