import type { PatientStatus } from "@shared/types/telemetry";

export function statusLabel(status: PatientStatus): string {
  switch (status) {
    case "WAITING":
      return "Waiting for your turn";
    case "STREAMING":
      return "Care team can see you on camera";
    case "IN_TRIAGE":
      return "A nurse is reviewing your case";
    case "ESCALATED":
      return "Your case is being prioritized";
    default:
      return "In the waiting room";
  }
}
