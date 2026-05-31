import { useEffect, useRef } from "react";
import type { AlertEvent } from "@shared/types/telemetry";

interface FallAlertModalProps {
  alert: AlertEvent;
  patientName: string | null;
  onAcknowledge: (alertId: string) => void;
}

function playAlertTone() {
  try {
    const ctx = new AudioContext();
    const beep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
      osc.start(startTime);
      osc.stop(startTime + 0.18);
    };
    // Urgent tri-tone alarm pattern
    beep(ctx.currentTime + 0.00, 880);
    beep(ctx.currentTime + 0.22, 1046);
    beep(ctx.currentTime + 0.44, 1318);
    beep(ctx.currentTime + 0.66, 880);
    beep(ctx.currentTime + 0.88, 1046);
    beep(ctx.currentTime + 1.10, 1318);
  } catch {
    // Audio not available
  }
}

export function FallAlertModal({ alert, patientName, onAcknowledge }: FallAlertModalProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    playAlertTone();
    intervalRef.current = setInterval(playAlertTone, 3500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [alert.alert_id]);

  const elapsed = Math.floor(
    (Date.now() - new Date(alert.created_at).getTime()) / 1000,
  );
  const elapsedLabel =
    elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s ago`;

  return (
    <div
      className="fall-alert-overlay fixed inset-0 z-[100] flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fall-alert-title"
    >
      <div className="fall-alert-modal relative mx-4 w-full max-w-lg border-2 border-[var(--status-critical)] bg-white">

        {/* Pulsing header bar */}
        <div className="fall-alert-bar flex items-start gap-3 bg-[var(--status-critical)] px-5 py-4">
          <span className="fall-alert-icon mt-0.5 text-3xl font-black leading-none text-white select-none">
            ⚠
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-200">
              Critical Emergency — Immediate Response Required
            </p>
            <p
              id="fall-alert-title"
              className="mt-0.5 text-xl font-black uppercase tracking-widest text-white"
            >
              Fall Detected
            </p>
          </div>
          {patientName && (
            <span className="shrink-0 self-center border border-red-300 bg-red-900/40 px-2.5 py-1 text-xs font-black uppercase tracking-widest text-white">
              {patientName}
            </span>
          )}
        </div>

        {/* Alert detail */}
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <p className="text-[13px] font-semibold leading-snug text-[var(--text)]">
            {alert.message}
          </p>
          <div className="mt-2 flex items-center gap-4">
            <span className="telemetry-value text-[10px] text-[var(--text-dim)]">
              {new Date(alert.created_at).toLocaleTimeString("en-GB")}
            </span>
            <span className="telemetry-value text-[10px] font-bold text-[var(--status-critical)]">
              {elapsedLabel}
            </span>
            <span className="telemetry-value text-[10px] text-[var(--text-dim)] ml-auto">
              REF {alert.alert_id.slice(-8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => onAcknowledge(alert.alert_id)}
            className="fall-ack-btn w-full bg-[var(--status-critical)] py-3.5 text-sm font-black uppercase tracking-[0.2em] text-white"
          >
            Acknowledge — I Am Responding
          </button>
          <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
            Alarm will repeat until acknowledged
          </p>
        </div>
      </div>
    </div>
  );
}
