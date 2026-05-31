"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CasefileChat } from "../components/CasefileChat";
import { CameraPanel } from "../components/camera/CameraPanel";
import { HelpRequest } from "../components/help/HelpRequest";
import { QueueHero } from "../components/queue/QueueHero";
import { DepartmentStatus } from "../components/queue/DepartmentStatus";
import { PageShell } from "../components/ui/PageShell";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { MOCK_ACUITY_LOAD, MOCK_QUEUE_STATUS } from "@/lib/mock-data";
import { linkPatientSession } from "@/lib/auth-api";
import { isFirebaseAuthEnabled, ensureAnonymousAuth } from "@/lib/firebase";
import {
  connectPatientSocket,
  getQueueStatus,
  isMockMode,
  sendCameraStatus,
  sendHelpRequest,
} from "@/lib/ws-client";
import type { QueueStatus, TelemetryEnvelope } from "@shared/types/telemetry";

const PATIENT_ID_KEY = "er-overwatch-patient-id";

function resolvePatientId(searchParam: string | null): string | null {
  if (searchParam) {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PATIENT_ID_KEY, searchParam);
    }
    return searchParam;
  }
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem(PATIENT_ID_KEY);
    if (stored) return stored;
  }
  if (isMockMode()) {
    return MOCK_QUEUE_STATUS.patient_id;
  }
  return null;
}

function QueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = resolvePatientId(searchParams.get("patientId"));

  useEffect(() => {
    if (!patientId) {
      router.replace("/");
    }
  }, [patientId, router]);

  const [queue, setQueue] = useState<QueueStatus>(MOCK_QUEUE_STATUS);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [wsConnected, setWsConnected] = useState(isMockMode());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!patientId) return;
    const id: string = patientId;

    let cancelled = false;

    async function connectQueue() {
      setFetchError(null);
      try {
        if (isFirebaseAuthEnabled()) {
          await ensureAnonymousAuth();
          await linkPatientSession(id);
        }

        const queueData = await getQueueStatus(id);
        if (cancelled) return;
        setQueue(queueData);
        setQueueLoaded(true);

        let ws: WebSocket | null = null;
        try {
          ws = await connectPatientSocket(id, (data: TelemetryEnvelope<QueueStatus>) => {
            if (data.type === "QUEUE_UPDATE" && data.payload) {
              setQueue(data.payload);
              setFetchError(null);
            }
          });
        } catch (wsErr) {
          if (!cancelled) {
            const msg =
              wsErr instanceof Error ? wsErr.message : "Could not connect for live updates.";
            setFetchError(msg);
          }
        }
        if (cancelled) {
          ws?.close();
          return;
        }
        wsRef.current = ws;
        if (!ws) {
          setWsConnected(false);
          return;
        }
        ws.onopen = () => {
          setWsConnected(true);
          setFetchError(null);
        };
        ws.onclose = (event) => {
          setWsConnected(false);
          wsRef.current = null;
          if (event.code === 1008 && event.reason) {
            setFetchError(
              event.reason.includes("mismatch")
                ? "Session expired — go back and sign in with your patient ID again."
                : event.reason,
            );
          }
        };
        ws.onerror = () => setWsConnected(false);
      } catch (err) {
        if (cancelled) return;
        if (isMockMode()) {
          setQueue(MOCK_QUEUE_STATUS);
          setQueueLoaded(true);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Could not load queue status.";
        setFetchError(
          message.includes("fetch") || message.includes("reach")
            ? "Cannot reach the triage server. Ensure the backend is running (port 8000), then refresh."
            : message,
        );
        setWsConnected(false);
        setQueueLoaded(true);
      }
    }

    void connectQueue();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [patientId]);

  if (!patientId) {
    return (
      <PageShell title="Patient Portal" subtitle="Sign in with your patient ID">
        <p className="text-center text-sm text-muted">Redirecting to sign in…</p>
      </PageShell>
    );
  }

  const pid: string = patientId;

  function handleHelp() {
    if (isMockMode()) {
      setHelpSent(true);
      console.info("[mock] Help request sent for", pid);
      return;
    }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      sendHelpRequest(ws, pid);
      setHelpSent(true);
      return;
    }

    if (ws?.readyState === WebSocket.CONNECTING) {
      ws.addEventListener(
        "open",
        () => {
          sendHelpRequest(ws, pid);
          setHelpSent(true);
        },
        { once: true },
      );
      return;
    }

    setFetchError("Not connected — wait until status shows Connected, then try again.");
  }

  function notifyCameraStatus(enabled: boolean) {
    if (isMockMode()) return;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      sendCameraStatus(ws, pid, enabled);
      return;
    }
    if (ws?.readyState === WebSocket.CONNECTING) {
      ws.addEventListener("open", () => sendCameraStatus(ws, pid, enabled), { once: true });
    }
  }

  return (
    <PageShell title="Your queue" subtitle="Live waiting room status">
      {fetchError && (
        <p
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}
          role="alert"
        >
          {fetchError}
        </p>
      )}

      <QueueHero
        queue={queue}
        wsConnected={wsConnected}
        isMockMode={isMockMode()}
        loading={!queueLoaded}
      />
      <DepartmentStatus data={queue.acuity_load ?? MOCK_ACUITY_LOAD} />
      <CasefileChat patientId={pid} />
      <CameraPanel patientId={pid} onCameraChange={notifyCameraStatus} />

      <div className="mt-auto pt-2">
        <HelpRequest onConfirm={handleHelp} disabled={helpSent} sent={helpSent} />
      </div>
    </PageShell>
  );
}

export default function QueuePage() {
  return (
    <Suspense
      fallback={
        <PageShell title="Your queue" subtitle="Loading…">
          <PageSkeleton />
        </PageShell>
      }
    >
      <QueueContent />
    </Suspense>
  );
}
