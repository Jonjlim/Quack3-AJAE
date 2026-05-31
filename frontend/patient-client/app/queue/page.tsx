"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AcuityLoad } from "../components/AcuityLoad";
import { CameraToggle } from "../components/CameraToggle";
import { HelpButton } from "../components/HelpButton";
import { MOCK_ACUITY_LOAD, MOCK_QUEUE_STATUS } from "@/lib/mock-data";
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
  const [helpSent, setHelpSent] = useState(false);
  const [wsConnected, setWsConnected] = useState(isMockMode());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!patientId) return;
    setFetchError(null);
    getQueueStatus(patientId)
      .then(setQueue)
      .catch((err) => {
        if (isMockMode()) {
          setQueue(MOCK_QUEUE_STATUS);
        } else {
          setFetchError(
            err instanceof Error ? err.message : "Could not load queue status.",
          );
        }
      });

    const ws = connectPatientSocket(patientId, (data: TelemetryEnvelope<QueueStatus>) => {
      if (data.type === "QUEUE_UPDATE" && data.payload) {
        setQueue(data.payload);
        setFetchError(null);
      }
    });
    wsRef.current = ws;

    if (!ws) {
      setWsConnected(false);
      return;
    }
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setWsConnected(false);
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [patientId]);

  if (!patientId) {
    return <div className="p-8 text-center text-slate-600">Redirecting to sign in…</div>;
  }

  function handleHelp() {
    if (isMockMode()) {
      setHelpSent(true);
      console.info("[mock] Help request sent for", patientId);
      return;
    }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      sendHelpRequest(ws, patientId);
      setHelpSent(true);
      return;
    }

    if (ws?.readyState === WebSocket.CONNECTING) {
      ws.addEventListener(
        "open",
        () => {
          sendHelpRequest(ws, patientId);
          setHelpSent(true);
        },
        { once: true },
      );
      return;
    }

    setFetchError("Not connected — wait for Live status, then try again.");
  }

  function notifyCameraStatus(enabled: boolean) {
    if (isMockMode()) return;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      sendCameraStatus(ws, patientId, enabled);
      return;
    }
    if (ws?.readyState === WebSocket.CONNECTING) {
      ws.addEventListener("open", () => sendCameraStatus(ws, patientId, enabled), { once: true });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-8">
      <header>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-blue-600">Queue Status</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              wsConnected
                ? "bg-emerald-100 text-emerald-800"
                : isMockMode()
                  ? "bg-slate-100 text-slate-600"
                  : "bg-amber-100 text-amber-800"
            }`}
            title={
              isMockMode()
                ? "Mock mode — no live updates"
                : wsConnected
                  ? "Live queue updates"
                  : "Reconnecting…"
            }
          >
            {isMockMode() ? "Mock" : wsConnected ? "Live" : "Offline"}
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-bold">Position #{queue.queue_position}</h1>
        <p className="mt-2 text-slate-600">
          Waiting {queue.wait_minutes} min · Est. {queue.estimated_wait_minutes} min total
        </p>
      </header>

      {fetchError && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800" role="alert">
          {fetchError}
        </p>
      )}

      <AcuityLoad data={queue.acuity_load ?? MOCK_ACUITY_LOAD} />
      <CameraToggle patientId={patientId} onCameraChange={notifyCameraStatus} />
      <HelpButton onHelp={handleHelp} disabled={helpSent} />
      {helpSent && (
        <p className="text-center text-sm font-medium text-red-600">
          Help request sent — a nurse has been notified.
        </p>
      )}
    </main>
  );
}

export default function QueuePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading queue…</div>}>
      <QueueContent />
    </Suspense>
  );
}
