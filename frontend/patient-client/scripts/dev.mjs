import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next");

function isUsableLanIp(ip) {
  if (!ip || ip.startsWith("127.") || ip.startsWith("169.254.")) return false;
  // Guest/captive-portal networks often assign unreachable addresses like 192.0.0.2
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

const ip = getLanIp();
console.log("");
if (ip) {
  console.log("  Open on your phone (same Wi-Fi):");
  console.log(`  http://${ip}:3000`);
} else {
  console.log("  LAN URL unavailable (guest Wi-Fi often blocks phone access).");
  console.log("  Use: npm run dev:tunnel");
  console.log("  Or connect Mac + phone to a personal hotspot, then restart.");
}
console.log("");

const child = spawn(nextBin, ["dev", "-H", "0.0.0.0", "-p", "3000"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
