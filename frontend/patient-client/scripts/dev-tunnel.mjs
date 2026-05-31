import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next");
const PORT = 3000;

function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(check, 300);
      });
    };
    check();
  });
}

function startNextDev() {
  const child = spawn(nextBin, ["dev", "-H", "127.0.0.1", "-p", String(PORT)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

function startTunnel() {
  console.log("  Starting Cloudflare tunnel (first run may download cloudflared)…");
  console.log("");

  const tunnel = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${PORT}`],
    { stdio: ["inherit", "pipe", "pipe"], shell: process.platform === "win32" },
  );

  let printed = false;
  const onData = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    process.stdout.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !printed) {
      printed = true;
      console.log("");
      console.log("  Open on your phone (any network):");
      console.log(`  ${match[0]}`);
      console.log("");
      console.log("  API calls are proxied through this URL.");
      console.log("  Start the backend separately: cd backend/triage-engine && ./run.sh");
      console.log("");
    }
  };

  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
  tunnel.on("exit", (code) => process.exit(code ?? 0));
}

console.log("");
console.log("  Tunnel mode — works when guest Wi-Fi blocks LAN access.");
console.log("");

startNextDev();

waitForPort(PORT)
  .then(startTunnel)
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });

process.on("SIGINT", () => process.exit(0));
