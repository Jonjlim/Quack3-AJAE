import type { AcuityLoad, QueueStatus } from "@shared/types/telemetry";

/** Matches docs/API_endpoints.md examples (mock-first). */
export const MOCK_ACUITY_LOAD: AcuityLoad = {
  active_traumas: 2,
  severe_count: 1,
  emergent_count: 3,
  total_waiting: 14,
  estimated_wait_minutes: 45,
  updated_at: "2026-05-30T18:12:00Z",
};

export const MOCK_QUEUE_STATUS: QueueStatus = {
  patient_id: "pat-001",
  queue_position: 4,
  wait_minutes: 12,
  estimated_wait_minutes: 45,
  status: "WAITING",
  acuity_load: MOCK_ACUITY_LOAD,
};
