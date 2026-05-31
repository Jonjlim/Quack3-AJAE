/** API client for the Gemini case-file chat feature. */

import { getApiBase } from "@/lib/api-base";
import type { CasefileChatResponse, CasefileMessage } from "@shared/types/telemetry";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

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

  const res = await fetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/chat`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
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

  const res = await fetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/chat-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
  return res.json() as Promise<CasefileChatResponse>;
}

/** Fetch full conversation history. */
export async function getConversation(patientId: string): Promise<CasefileMessage[]> {
  if (USE_MOCK) return [];

  const res = await fetch(
    `${getApiBase()}/api/v1/casefile/${encodeURIComponent(patientId)}/conversation`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}
