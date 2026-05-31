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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <span className="telemetry-label text-[var(--text-dim)]">Initializing…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
        <header className="cc-header-stripe flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="telemetry-label text-[var(--text-dim)]">ER · Overwatch</p>
          <h1 className="text-sm font-semibold tracking-tight">Nurse Command Center</h1>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-6">
          <div className="panel w-full max-w-sm p-4 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-widest">Sign In</h2>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Authenticate to access the triage dashboard.
            </p>
            {error && (
              <p
                className="mt-3 border border-[var(--status-critical)] bg-red-50 px-2 py-1.5 text-[11px] text-[var(--status-critical)]"
                role="alert"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={loading}
              className="mt-4 w-full border border-slate-800 bg-slate-800 py-2 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in with Google"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[10px] text-[var(--text-muted)]">
        <span>{user.email ?? user.displayName ?? "Nurse"}</span>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="uppercase tracking-wider text-[var(--text-2)] hover:text-[var(--text)]"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
