/** Map internal camera/vitals status strings to patient-safe copy. */
export function patientSafeStatus(status: string): { headline: string; sub?: string } {
  if (status === "Camera off") {
    return { headline: "Camera off", sub: "Share video only when you feel comfortable." };
  }
  if (status.startsWith("Connecting")) {
    return { headline: "Connecting…", sub: "Setting up a secure link to your care team." };
  }
  if (status.includes("permission denied")) {
    return {
      headline: "Camera access needed",
      sub: "Allow camera access in your browser settings, then try again.",
    };
  }
  if (status.includes("triage server") || status.includes("Connection failed")) {
    return {
      headline: "Could not connect",
      sub: "Please check your connection and try again in a moment.",
    };
  }
  if (status.includes("patient not found")) {
    return {
      headline: "Session expired",
      sub: "Please sign in again with your patient ID.",
    };
  }
  if (status.includes("backend unavailable") || status.includes("dependencies")) {
    return {
      headline: "Vitals temporarily unavailable",
      sub: "Your video is still shared with the care team.",
    };
  }
  if (status.includes("Hold still") || status.includes("measuring")) {
    return { headline: "Measuring vitals", sub: "Hold still and face the camera (~8 sec)." };
  }
  if (status.includes("HR") && status.includes("bpm")) {
    const match = status.match(/HR\s+(\d+)\s+bpm/);
    const hr = match?.[1];
    const range = status.match(/\((\d+)[–-](\d+)\)/);
    if (hr && range) {
      return {
        headline: `${hr} bpm`,
        sub: `Estimated range ${range[1]}–${range[2]}`,
      };
    }
    if (hr) return { headline: `${hr} bpm`, sub: "Heart rate estimate" };
  }
  if (status.includes("hold still") || status.includes("face visible")) {
    return { headline: "Keep face visible", sub: "We're still calibrating your vitals." };
  }
  if (status.startsWith("Streaming")) {
    return { headline: "Live with care team", sub: status.replace(/^Streaming ·\s*/, "") };
  }
  return { headline: status };
}
