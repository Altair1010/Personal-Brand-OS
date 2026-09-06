import fs from "node:fs";
import path from "node:path";

export interface ResolvedLocalRepository {
  readonly alias: string;
  readonly path: string;
}

const ALIAS = /^[a-z0-9](?:[a-z0-9._-]{0,62})$/;

function normalizedForComparison(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(normalizedForComparison(root), normalizedForComparison(candidate));
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) return;
  throw new Error("WORKER_REPOSITORY_PATH_ESCAPE");
}

export class LocalRepositoryResolver {
  private readonly root: string;
  private readonly mappings: ReadonlyMap<string, string>;

  constructor(allowedRoot: string, mappings: Readonly<Record<string, string>>) {
    this.root = fs.realpathSync(allowedRoot);
    const resolved = new Map<string, string>();
    for (const [alias, configuredPath] of Object.entries(mappings)) {
      if (!ALIAS.test(alias)) throw new Error("WORKER_REPOSITORY_ALIAS_INVALID");
      const realPath = fs.realpathSync(configuredPath);
      assertContained(this.root, realPath);
      resolved.set(alias, realPath);
    }
    this.mappings = resolved;
  }

  resolve(alias: string): ResolvedLocalRepository {
    if (!ALIAS.test(alias)) throw new Error("WORKER_REPOSITORY_ALIAS_INVALID");
    const mapped = this.mappings.get(alias);
    if (!mapped) throw new Error("WORKER_REPOSITORY_NOT_ALLOWED");
    const realPath = fs.realpathSync(mapped);
    assertContained(this.root, realPath);
    return { alias, path: realPath };
  }
}
