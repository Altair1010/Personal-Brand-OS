// M12 packaging pre-step. Run AFTER `next build`, BEFORE `electron-builder`.
// Next `output:'standalone'` does NOT copy `.next/static` or `public` next to
// server.js. At runtime `prepareStandaloneAssets()` handles that for the unpackaged
// `--prod` boot, but it is skipped when packaged — so the layout must be pre-baked
// here into the tree that electron-builder ships via extraResources.
//   .next/static  -> .next/standalone/.next/static
//   public/       -> .next/standalone/public   (no-op if public/ absent)

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const jobs = [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
];

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error(
    "[prepare-package] .next/standalone/server.js missing — run `next build` first.",
  );
  process.exit(1);
}

for (const [src, dest] of jobs) {
  if (!fs.existsSync(src)) {
    console.log(`[prepare-package] skip (absent): ${src}`);
    continue;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[prepare-package] copied ${src} -> ${dest}`);
}
console.log("[prepare-package] done");
