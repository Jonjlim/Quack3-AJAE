/** API client for the nurse-side case-file report feature. */

import { authFetch } from "./auth-fetch";
import { getApiBase, isMockMode } from "./api-base";

const USE_MOCK = isMockMode();

/** Fetch the markdown report for a patient. */
export async function getReportMarkdown(patientId: string): Promise<string> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1500));
    return `## Chief Complaint\nPatient reports severe abdominal pain.\n\n## History of Present Illness\nPain started approximately 3 hours ago, progressively worsening.\n\n## Symptom Details\n- Abdominal pain: 7/10, lower right quadrant\n- Nausea\n- Low-grade fever\n\n## Medications & Allergies\n- Ibuprofen 400mg taken 2 hours ago\n- No known allergies\n\n## Relevant Medical History\nNot discussed\n\n## Symptom Timeline\n- 15:30 — Initial pain onset\n- 16:45 — Pain intensified, moved to lower right\n- 17:00 — Nausea began\n\n## Additional Context\nPatient last ate 5 hours ago.`;
  }

  const res = await authFetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/report`,
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("No conversation data for this patient yet.");
    throw new Error(`Report generation failed (${res.status})`);
  }
  const data = await res.json();
  return data.report_markdown ?? "";
}

/** Get the URL for downloading the PDF report. */
export function getReportPdfUrl(patientId: string): string {
  return `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/report-pdf`;
}

/** Check if a patient has any conversation data. */
export async function hasConversation(patientId: string): Promise<boolean> {
  if (USE_MOCK) return true;

  try {
    const res = await authFetch(
      `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/conversation`,
    );
    if (!res.ok) return false;
    const data = await res.json();
    return (data.messages?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
