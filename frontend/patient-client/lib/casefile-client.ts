/** API client for the Gemini case-file chat feature. */

import { authFetch } from "@/lib/auth-fetch";
import { getApiBase, isMockMode } from "@/lib/api-base";
import type { CasefileChatResponse, CasefileMessage } from "@shared/types/telemetry";

const USE_MOCK = isMockMode();

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // ignore JSON parse errors
  }
  return `Chat failed (${res.status})`;
}

/** Send recorded audio blob to Gemini for transcription + response. */
export async function sendAudioMessage(
  patientId: string,
  audioBlob: Blob,
): Promise<CasefileChatResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1000));
    return {
      response: "Thanks for sharing that. Can you describe the pain — is it sharp, dull, or throbbing?",
      transcript: "(mock transcript)",
      message_count: 2,
    };
  }

  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");

  const res = await authFetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/chat`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<CasefileChatResponse>;
}

/** Send typed text to Gemini. */
export async function sendTextMessage(
  patientId: string,
  text: string,
): Promise<CasefileChatResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      response: "I understand. How long ago did this start?",
      transcript: text,
      message_count: 2,
    };
  }

  const res = await authFetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/chat-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<CasefileChatResponse>;
}

/** Fetch full conversation history. */
export async function getConversation(patientId: string): Promise<CasefileMessage[]> {
  if (USE_MOCK) return [];

  const res = await authFetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/conversation`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}
