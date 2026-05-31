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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#f0f2f5", color: "var(--text-muted)" }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col" style={{ color: "var(--text)" }}>
        <header
          className="cc-header-stripe flex-shrink-0 px-5 py-3"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <p
            className="text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ color: "var(--accent)" }}
          >
            ER · Overwatch
          </p>
          <h1 className="text-base font-bold tracking-tight">Nurse Command Center</h1>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-8">
          <div
            className="w-full max-w-md rounded-2xl border p-8 text-center"
            style={{
              background: "#ffffff",
              borderColor: "#e2e8f0",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <h2 className="text-xl font-bold">Sign in</h2>
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
              Sign in with your Google account to access the triage dashboard.
            </p>
            {error && (
              <p
                className="mt-4 rounded-xl px-3 py-2 text-sm"
                style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626" }}
                role="alert"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={loading}
              className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#2563eb" }}
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
      <div
        className="flex items-center justify-end gap-3 border-b px-4 py-1.5 text-xs"
        style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "var(--text-muted)" }}
      >
        <span>{user.email ?? user.displayName ?? "Nurse"}</span>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="underline hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
