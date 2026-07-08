// Electron desktop shell (milestone M11, Phase A — dev window).
// Boots the existing Next.js server as a child process and points a window at it.
// MUST NOT change any web behavior — it only wraps the running app. See RULES.md >
// "Approved scope exceptions". Phase B (production installer + Prisma engine bundling) later.

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = process.env.PBOS_PORT || "3005";
const APP_URL = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, "..");

let serverProc = null;
let win = null;

function startNext() {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  serverProc = spawn(
    process.platform === "win32" ? "node.exe" : "node",
    [nextBin, "dev", "-p", PORT],
    {
      cwd: ROOT,
      env: { ...process.env, PORT },
      stdio: "inherit",
    },
  );
  serverProc.on("exit", () => {
    serverProc = null;
  });
}

// Poll the server until it answers, then run cb. ~60s budget (120 * 500ms).
function waitForServer(cb, tries = 0) {
  const req = http.get(APP_URL, () => cb());
  req.on("error", () => {
    if (tries > 120) {
      cb(new Error("Next server did not start in time"));
      return;
    }
    setTimeout(() => waitForServer(cb, tries + 1), 500);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Personal Brand OS",
    backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(APP_URL);
  // Open external links (target=_blank) in the default browser, not a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.on("closed", () => {
    win = null;
  });
}

// Kill the Next server (and its worker children) on shutdown.
function shutdown() {
  if (!serverProc) return;
  const pid = serverProc.pid;
  serverProc = null;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"]);
    } else {
      process.kill(pid);
    }
  } catch {
    /* already gone */
  }
}

app.whenReady().then(() => {
  startNext();
  waitForServer((err) => {
    if (err) console.error("[pbos]", err.message);
    createWindow();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  shutdown();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", shutdown);
