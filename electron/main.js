// Electron desktop shell (milestone M11).
// Two boot modes, selected at runtime — the wrapper NEVER changes web behavior, it only
// boots the existing Next server and points a window at it without changing web behavior:
//   - dev  (default): spawn `next dev` (unchanged from Phase A).
//   - prod (packaged, or local `--prod`): boot the Next `output:'standalone'` server with
//     Electron's own node, DB relocated to userData, first-run migrate, API key from userData/pbos.env.

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const rt = require("./runtime");

const PORT = process.env.PBOS_PORT || "3005";
const APP_URL = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, "..");
const PROD = rt.isProd(app, process.argv);

let serverProc = null;
let win = null;

// ── dev boot (unchanged) ──────────────────────────────────────────────────────
function startNextDev() {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  serverProc = spawn(
    process.platform === "win32" ? "node.exe" : "node",
    [nextBin, "dev", "-p", PORT],
    { cwd: ROOT, env: { ...process.env, PORT }, stdio: "inherit" },
  );
  serverProc.on("exit", () => {
    serverProc = null;
  });
}

// ── production boot ───────────────────────────────────────────────────────────
// Returns the standalone server path once the child is spawned. Throws (caller aborts)
// if the production build is missing — never open a blank window against nothing.
async function startNextProd() {
  const paths = rt.resolvePaths(app, ROOT);
  if (!fs.existsSync(paths.standaloneServer)) {
    throw new Error(
      `Production build missing: ${paths.standaloneServer}. Run \`npm run build:desktop\` first.`,
    );
  }

  const databaseUrl = rt.resolveDatabaseUrl(app, ROOT, true);
  const dbExistedBefore = fs.existsSync(rt.dbFileFromUrl(databaseUrl));
  const injectedKeys = rt.loadUserEnv(app);

  rt.prepareStandaloneAssets(app, paths);
  await rt.firstRunSetup({
    execPath: process.execPath,
    paths,
    databaseUrl,
    dbExistedBefore,
  });

  serverProc = spawn(process.execPath, [paths.standaloneServer], {
    cwd: paths.standaloneDir,
    env: {
      ...process.env,
      ...injectedKeys,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT,
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
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

// Kill the child server (and its worker children) on shutdown.
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

app.whenReady().then(async () => {
  try {
    if (PROD) await startNextProd();
    else startNextDev();
  } catch (err) {
    console.error("[pbos]", err.message);
    dialog.showErrorBox("Personal Brand OS — boot failed", err.message);
    app.quit();
    return;
  }
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
