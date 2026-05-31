/** Browsers only expose getUserMedia in secure contexts (HTTPS or localhost). */
export function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

export function isCameraApiAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function cameraUnavailableMessage(): string {
  if (typeof window === "undefined") {
    return "Camera unavailable";
  }
  const { hostname, protocol } = window.location;
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1";

  if (!window.isSecureContext && !isLocal) {
    if (protocol === "http:") {
      return "Camera blocked on HTTP — open the https:// URL shown in the terminal (accept the certificate on your phone), or use localhost on this computer";
    }
    return "Camera requires HTTPS — run npm run dev:tunnel and open the Cloudflare URL on your phone";
  }

  if (!isCameraApiAvailable()) {
    return "Camera not supported in this browser — try Safari or Chrome";
  }

  return "Camera unavailable";
}

export function assertCameraAvailable(): void {
  if (!isCameraApiAvailable()) {
    throw new Error(cameraUnavailableMessage());
  }
}
