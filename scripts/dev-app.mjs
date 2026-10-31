// Consistent Tauri development launches on Windows (adapted from TaskMap's scripts/dev-app.mjs).
//
// Stopping `tauri dev` from a terminal or tool often leaves this checkout's Vite server or debug
// rankdb.exe running, so the next launch fails on a busy port or attaches to a stale renderer.
// This stops only processes that belong to this checkout, waits for the ports, and names any
// foreign owner instead of killing it.
//
// Usage: node scripts/dev-app.mjs [--devtools-port <port>] [tauri dev arguments...]
//   --devtools-port exposes the WebView2 DevTools protocol on 127.0.0.1 for scripts/bench.mjs.
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const debugTarget = path.join(root, "src-tauri", "target").toLowerCase();
const args = process.argv.slice(2);
const devtoolsFlag = args.indexOf("--devtools-port");
const devtoolsPort = devtoolsFlag === -1 ? null : Number(args[devtoolsFlag + 1]);
if (devtoolsFlag !== -1) {
  if (!Number.isInteger(devtoolsPort)) throw new Error("--devtools-port needs a port number");
  args.splice(devtoolsFlag, 2);
}
const VITE_PORT = 5180;
const MCP_PORT = 9223;
const PORTS = [
  VITE_PORT,
  ...(args.some((arg) => arg.includes("mcp-development")) ? [MCP_PORT] : []),
  ...(devtoolsPort === null ? [] : [devtoolsPort]),
];

function processes() {
  if (process.platform !== "win32") return [];
  const script =
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','rankdb.exe') } | " +
    "Select-Object ProcessId, Name, ExecutablePath, CommandLine | ConvertTo-Json -Compress";
  const output = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
  }).trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function ownsProcess({ Name, ExecutablePath, CommandLine }) {
  const exe = (ExecutablePath ?? "").toLowerCase();
  const command = (CommandLine ?? "").toLowerCase();
  if (Name === "rankdb.exe") return exe.startsWith(debugTarget);
  return (
    command.includes(root.toLowerCase()) &&
    /[\\/]vite[\\/]bin[\\/]vite\.js|@tauri-apps[\\/]cli/.test(command)
  );
}

function stopStaleProcesses() {
  const stale = processes().filter(
    (entry) =>
      entry.ProcessId !== process.pid && entry.ProcessId !== process.ppid && ownsProcess(entry),
  );
  for (const entry of stale) {
    try {
      execFileSync("taskkill", ["/PID", String(entry.ProcessId), "/T", "/F"], { stdio: "ignore" });
      console.log(`[dev-app] stopped stale ${entry.Name} (${entry.ProcessId})`);
    } catch {
      /* Already exited. */
    }
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

function portOwner(port) {
  try {
    return execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
          'if ($c) { (Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)").CommandLine }',
      ],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function waitForPorts() {
  const deadline = Date.now() + 5000;
  for (const port of PORTS) {
    while (!(await portFree(port))) {
      if (Date.now() > deadline) {
        const owner = portOwner(port);
        console.error(
          `[dev-app] port ${port} is still in use${owner ? ` by: ${owner}` : ""}. ` +
            "It does not belong to this checkout, so it was not stopped.",
        );
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

stopStaleProcesses();
await waitForPorts();

const env = { ...process.env };
if (devtoolsPort !== null) {
  // WebView2 reads extra Chromium switches from this variable when the window is created.
  env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = [
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS,
    `--remote-debugging-port=${devtoolsPort}`,
    "--remote-allow-origins=*",
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`[dev-app] WebView2 DevTools protocol on 127.0.0.1:${devtoolsPort}`);
}

const child = spawn("npx", ["tauri", "dev", ...args], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});

const stopChild = () => {
  if (child.exitCode !== null || !child.pid) return;
  try {
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    /* Already exited. */
  }
};
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
  process.on(signal, () => {
    stopChild();
    process.exit(130);
  });
}
child.on("exit", (code) => {
  stopStaleProcesses();
  process.exit(code ?? 0);
});
