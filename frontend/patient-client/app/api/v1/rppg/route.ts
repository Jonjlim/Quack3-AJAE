import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RPPG_TIMEOUT_MS = 120_000;

/** Proxy rPPG uploads with a long timeout — Next rewrites drop long-running CV requests. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPPG_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${API_BASE}/api/v1/rppg`, {
      method: "POST",
      body: formData,
      headers,
      signal: controller.signal,
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Vitals analysis timed out — hold still and try again"
        : err instanceof Error
          ? err.message
          : "rPPG proxy failed";
    return NextResponse.json({ detail: message }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}

export const maxDuration = 120;
