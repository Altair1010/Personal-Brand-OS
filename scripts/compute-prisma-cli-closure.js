const fs = require("fs"), path = require("path");
const root = "node_modules";
function resolvePkgDir(name, fromDir) {
  let dir = fromDir;
  while (true) {
    const cand = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(cand, "package.json"))) return cand;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const top = path.join(root, name);
  if (fs.existsSync(path.join(top, "package.json"))) return top;
  return null;
}
const seen = new Set();
const tops = new Set();
function visit(name, fromDir) {
  const dir = resolvePkgDir(name, fromDir);
  if (!dir) { console.error("UNRESOLVED:", name, "from", fromDir); return; }
  if (seen.has(dir)) return;
  seen.add(dir);
  const rel = path.relative(root, dir).split(path.sep).join("/");
  tops.add(rel.split("/node_modules/")[0]);
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch { return; }
  const deps = Object.assign({}, pkg.dependencies, pkg.optionalDependencies);
  for (const d of Object.keys(deps)) visit(d, dir);
}
["@prisma/config", "c12", "deepmerge-ts", "effect", "empathic"].forEach(n => visit(n, path.join(root, "prisma")));
const list = [...tops].sort();
console.log("COUNT:", list.length);
console.log(list.join("\n"));
