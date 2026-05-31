"use client";

/**
 * CasefileChat — voice/text chat with Gemini for building patient case files.
 *
 * The patient taps a mic button to record, or types. Gemini responds with
 * follow-up questions to build deep context for the doctor's case file.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { sendAudioMessage, sendTextMessage, getConversation } from "@/lib/casefile-client";
import type { CasefileMessage } from "@shared/types/telemetry";
import { Surface } from "./ui/Surface";

interface CasefileChatProps {
  patientId: string;
}

interface LocalMessage {
  role: "patient" | "gemini";
  content: string;
  timestamp: string;
}

export function CasefileChat({ patientId }: CasefileChatProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing conversation on mount
  useEffect(() => {
    getConversation(patientId).then((msgs) => {
      if (msgs.length > 0) {
        setMessages(msgs.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })));
        setIsExpanded(true);
      }
    });
  }, [patientId]);

  // ── Audio recording ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the mic
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) return;

        // Send to Gemini
        setIsLoading(true);
        try {
          const res = await sendAudioMessage(patientId, blob);
          const now = new Date().toISOString();
          setMessages((prev) => [
            ...prev,
            { role: "patient", content: res.transcript || "(voice message)", timestamp: now },
            { role: "gemini", content: res.response, timestamp: now },
          ]);
          if (!isExpanded) setIsExpanded(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to send audio");
        } finally {
          setIsLoading(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [patientId, isExpanded]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ── Text send ───────────────────────────────────────────────────────────────

  const handleSendText = useCallback(async () => {
    const text = textDraft.trim();
    if (!text) return;
    setTextDraft("");
    setError(null);
    setIsLoading(true);
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "patient", content: text, timestamp: now }]);

    try {
      const res = await sendTextMessage(patientId, text);
      setMessages((prev) => [
        ...prev,
        { role: "gemini", content: res.response, timestamp: now },
      ]);
      if (!isExpanded) setIsExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }, [patientId, textDraft, isExpanded]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Collapsed state — just the CTA button ─────────────────────────────────

  if (!isExpanded) {
    return (
      <Surface>
        <h2 className="text-section-title">Symptom questions</h2>
        <p className="mt-2 text-sm text-muted">
          Answer a few questions while you wait. Your answers help your care team prepare.
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="mt-5 w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Open intake questions
        </button>
      </Surface>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-section-title">Symptom questions</h2>
          <p className="text-sm text-muted">Helps your care team prepare</p>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted">
          {messages.length} messages
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto px-5 py-4" style={{ minHeight: 120 }}>
        {messages.length === 0 && !isLoading && (
          <p className="py-6 text-center text-sm text-muted">
            Use the microphone or type below to describe your symptoms. You may be asked follow-up
            questions.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === "patient" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "patient"
                  ? "bg-accent/10 text-ink"
                  : "border border-border bg-surface-2 text-ink"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-2 flex justify-start">
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
              …
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {error && (
        <p
          className="mx-5 mb-2 rounded-xl px-4 py-2 text-sm"
          style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626" }}
        >
          {error}
        </p>
      )}

      <div className="border-t border-border px-5 py-4">
        {showTextInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendText()}
              placeholder="Type your message…"
              disabled={isLoading}
              className="min-w-0 flex-1 rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendText}
              disabled={isLoading || !textDraft.trim()}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-50 ${
                isRecording ? "bg-clay" : "bg-accent"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                /* Stop icon */
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                /* Mic icon */
                <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            {isRecording && (
              <p className="text-sm font-medium text-clay">
                Recording… {formatTime(recordingTime)}
              </p>
            )}
            {!isRecording && (
              <p className="text-xs text-muted">
                {messages.length === 0
                  ? "Tap to start talking"
                  : "Tap to add more details"}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowTextInput(!showTextInput)}
          className="mt-3 w-full text-center text-xs text-accent"
        >
          {showTextInput ? "Use microphone instead" : "Type instead"}
        </button>
      </div>
    </section>
  );
}
