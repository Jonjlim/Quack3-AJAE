import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next");
const certDir = path.join(__dirname, "..", "certificates");
const keyPath = path.join(certDir, "dev-key.pem");
const certPath = path.join(certDir, "dev-cert.pem");
const sanMetaPath = path.join(certDir, "dev-san.txt");

function isUsableLanIp(ip) {
  if (!ip || ip.startsWith("127.") || ip.startsWith("169.254.")) return false;
  if (ip.startsWith("192.0.0.")) return false;
  return (
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function getLanIpFromIfconfig() {
  for (const iface of ["en0", "en1", "wlan0", "eth0"]) {
    try {
      const result = spawnSync("ipconfig", ["getifaddr", iface], { encoding: "utf8" });
      const ip = result.stdout.trim();
      if (result.status === 0 && isUsableLanIp(ip)) return ip;
    } catch {
      // try next interface
    }
  }
  return null;
}

function getLanIpFromNode() {
  const candidates = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    if (!addresses) continue;
    for (const addr of addresses) {
      const isV4 = addr.family === "IPv4" || addr.family === 4;
      if (!isV4 || addr.internal) continue;
      if (isUsableLanIp(addr.address)) candidates.push(addr.address);
    }
  }
  return candidates[0] ?? null;
}

function getLanIp() {
  try {
    return getLanIpFromNode() ?? getLanIpFromIfconfig();
  } catch {
    return getLanIpFromIfconfig();
  }
}

function ensureDevCert(lanIp) {
  fs.mkdirSync(certDir, { recursive: true });
  const sans = ["DNS:localhost", "IP:127.0.0.1", "IP:0.0.0.0"];
  if (lanIp) sans.push(`IP:${lanIp}`);
  const sanLine = sans.join(",");

  if (
    fs.existsSync(keyPath) &&
    fs.existsSync(certPath) &&
    fs.existsSync(sanMetaPath) &&
    fs.readFileSync(sanMetaPath, "utf8").trim() === sanLine
  ) {
    return { keyPath, certPath };
  }

  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "365",
      "-subj",
      "/CN=localhost",
      "-addext",
      `subjectAltName=${sanLine}`,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    console.warn("  Could not generate dev HTTPS cert (need openssl).");
    console.warn("  Camera on phone: run npm run dev:tunnel");
    return null;
  }

  fs.writeFileSync(sanMetaPath, sanLine);
  return { keyPath, certPath };
}

const ip = getLanIp();
const cert = ensureDevCert(ip);

console.log("");
if (cert) {
  console.log("  Open on this computer:");
  console.log("  https://localhost:3000");
  if (ip) {
    console.log("");
    console.log("  Open on your phone (same Wi-Fi) — camera needs HTTPS:");
    console.log(`  https://${ip}:3000`);
    console.log("  (Tap Advanced → Proceed if the browser warns about the certificate)");
  }
} else if (ip) {
  console.log("  Open on this computer (camera works on localhost):");
  console.log("  http://localhost:3000");
  console.log("");
  console.log("  Phone camera requires HTTPS — run: npm run dev:tunnel");
} else {
  console.log("  LAN URL unavailable (guest Wi-Fi often blocks phone access).");
  console.log("  Use: npm run dev:tunnel");
}
console.log("");

const nextArgs = ["dev", "-H", "0.0.0.0", "-p", "3000"];
if (cert) {
  nextArgs.push(
    "--experimental-https",
    "--experimental-https-key",
    cert.keyPath,
    "--experimental-https-cert",
    cert.certPath,
  );
}

const child = spawn(nextBin, nextArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
