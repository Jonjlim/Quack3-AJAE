import type { BiometricReading, PatientRecord } from "@shared/types/telemetry";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";

interface BiometricModalProps {
  patient: PatientRecord | null;
  latestBiometric: BiometricReading | null;
  patientVideo: RemoteVideoTrack | null;
  onClose: () => void;
}

export function BiometricModal({
  patient,
  latestBiometric,
  patientVideo,
  onClose,
}: BiometricModalProps) {
  if (!patient) return null;

  const biometric = latestBiometric?.patient_id === patient.patient_id
    ? latestBiometric
    : patient.last_biometric;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-2xl">
        <header className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{patient.display_name}</h3>
            <p className="text-sm text-slate-400">{patient.chief_complaint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600"
          >
            Close
          </button>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-xs uppercase text-slate-500">Heart Rate</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {biometric?.heart_rate_bpm ?? "—"} <span className="text-sm font-normal">bpm</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-xs uppercase text-slate-500">Respiratory Rate</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {biometric?.respiratory_rate_bpm ?? "—"}{" "}
              <span className="text-sm font-normal">br/min</span>
            </p>
          </div>
        </div>

        <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-slate-800">
          {patientVideo ? (
            <RemoteVideo
              track={patientVideo.mediaStreamTrack}
              className="h-full w-full"
              label={patient.display_name}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {patient.camera_enabled
                ? "Camera active — connect LiveKit feed to view"
                : "Patient camera not streaming"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
