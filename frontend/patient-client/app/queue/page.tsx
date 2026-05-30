"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AcuityLoad } from "../components/AcuityLoad";
import { CameraToggle } from "../components/CameraToggle";
import { HelpButton } from "../components/HelpButton";
import { MOCK_ACUITY_LOAD, MOCK_QUEUE_STATUS } from "@/lib/mock-data";
import { connectPatientSocket, getQueueStatus, sendHelpRequest } from "@/lib/ws-client";
import type { QueueStatus } from "@shared/types/telemetry";

function QueueContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") ?? MOCK_QUEUE_STATUS.patient_id;
  const [queue, setQueue] = useState<QueueStatus>(MOCK_QUEUE_STATUS);
  const [helpSent, setHelpSent] = useState(false);

  useEffect(() => {
    getQueueStatus(patientId).then(setQueue).catch(() => setQueue(MOCK_QUEUE_STATUS));
    const ws = connectPatientSocket(patientId, (data) => {
      const envelope = data as { type?: string; payload?: QueueStatus };
      if (envelope.type === "QUEUE_UPDATE" && envelope.payload) {
        setQueue(envelope.payload);
      }
    });
    return () => ws?.close();
  }, [patientId]);

  function handleHelp() {
    const ws = connectPatientSocket(patientId, () => undefined);
    if (ws) {
      ws.onopen = () => {
        sendHelpRequest(ws, patientId);
        setHelpSent(true);
        ws.close();
      };
    } else {
      setHelpSent(true);
      console.info("[mock] Help request sent for", patientId);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-sm font-medium text-blue-600">Queue Status</p>
        <h1 className="mt-1 text-3xl font-bold">Position #{queue.queue_position}</h1>
        <p className="mt-2 text-slate-600">
          Waiting {queue.wait_minutes} min · Est. {queue.estimated_wait_minutes} min total
        </p>
      </header>

      <AcuityLoad data={queue.acuity_load ?? MOCK_ACUITY_LOAD} />
      <CameraToggle patientId={patientId} />
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
