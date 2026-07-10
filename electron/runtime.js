// Runtime helpers for the Electron desktop shell (milestone M11).
// Pure-ish helpers kept out of main.js: production detection, DB relocation to the
// OS user-data dir, runtime API-key injection (userData/pbos.env, NOT the repo .env),
// first-run `prisma migrate deploy` + seed. MUST NOT change any web behavior — it only
// wires env/paths around the existing Next server. See .trellis/spec/desktop/packaging-contract.md.

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Production when packaged, or when locally testing the production boot via `--prod`.
function isProd(app, argv) {
  return app.isPackaged || (argv || []).includes("--prod");
}

// Where the packaged/standalone assets live. Unpackaged (local --prod) → repo root.
// Packaged (M12) → process.resourcesPath. Kept here so main.js stays declarative.
function appRoot(app, root) {
  return app.isPackaged ? process.resourcesPath : root;
}

// SQLite path. Dev/non-prod → repo prisma/dev.db (unchanged). Production → a writable
// per-user file; the install dir is read-only so we never write there.
function resolveDatabaseUrl(app, root, prod) {
  if (!prod) return `file:${path.join(root, "prisma", "dev.db")}`;
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "pbos.db")}`;
}

function dbFileFromUrl(url) {
  return url.replace(/^file:/, "");
}

// Read API keys from userData/pbos.env (KEY=VALUE lines). Absent → {} (app still boots;
// AI calls surface "missing key"). Never reads the repo .env (project rule 3).
function loadUserEnv(app) {
  const file = path.join(app.getPath("userData"), "pbos.env");
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return out; // no file → no injected keys
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

// Resolve the standalone server + prisma CLI + migrations dir for the given mode.
function resolvePaths(app, root) {
  const base = appRoot(app, root);
  return {
    standaloneServer: path.join(base, ".next", "standalone", "server.js"),
    standaloneDir: path.join(base, ".next", "standalone"),
    staticSrc: path.join(base, ".next", "static"),
    publicSrc: path.join(base, "public"),
    prismaCli: path.join(root, "node_modules", "prisma", "build", "index.js"),
    tsxCli: path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
    seedScript: path.join(root, "prisma", "seed.ts"),
    schemaDir: root,
  };
}

// Recursive copy (Node >=20 has fs.cpSync). Idempotent.
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

// Next `output:'standalone'` does NOT copy .next/static or public next to server.js.
// For local unpackaged --prod boot, place them where the standalone server expects them.
// Packaged builds (M12) let electron-builder lay this out, so skip when packaged.
function prepareStandaloneAssets(app, paths) {
  if (app.isPackaged) return;
  copyDir(paths.staticSrc, path.join(paths.standaloneDir, ".next", "static"));
  copyDir(paths.publicSrc, path.join(paths.standaloneDir, "public"));
}

// Run a JS entry with Electron's own node (ELECTRON_RUN_AS_NODE=1). Resolves on exit 0.
function runNode(execPath, entry, args, env, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(execPath, [entry, ...args], {
      env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "inherit",
    });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited ${code}`));
    });
    proc.on("error", reject);
  });
}

// First-run wiring: apply migrations (always safe/idempotent), then seed only when the
// DB file did not exist before this boot. Runs BEFORE the window opens.
async function firstRunSetup({ execPath, paths, databaseUrl, dbExistedBefore }) {
  const env = { DATABASE_URL: databaseUrl };
  await runNode(
    execPath,
    paths.prismaCli,
    ["migrate", "deploy", "--schema", path.join(paths.schemaDir, "prisma", "schema.prisma")],
    env,
    "prisma migrate deploy",
  );
  if (!dbExistedBefore) {
    // Seed via the tsx entry directly (idempotent upserts). We resolve tsx's own path
    // instead of `prisma db seed` — the latter shells out to a bare `tsx` on PATH, which
    // is absent when launched from Electron. (M12 must bundle tsx + seed for packaged builds.)
    await runNode(execPath, paths.tsxCli, [paths.seedScript], env, "db seed");
  }
}

module.exports = {
  isProd,
  resolveDatabaseUrl,
  dbFileFromUrl,
  loadUserEnv,
  resolvePaths,
  prepareStandaloneAssets,
  firstRunSetup,
};
