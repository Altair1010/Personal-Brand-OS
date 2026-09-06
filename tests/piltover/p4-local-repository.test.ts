import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalRepositoryResolver } from "@/lib/piltover/modules/workers/infrastructure/local-repository-resolver";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("P4 local repository authority", () => {
  it("resolves an approved opaque alias and never accepts a remote path", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-repos-"));
    roots.push(root);
    const repo = path.join(root, "fixture");
    fs.mkdirSync(repo);
    const resolver = new LocalRepositoryResolver(root, { fixture: repo });

    expect(resolver.resolve("fixture").path).toBe(fs.realpathSync(repo));
    expect(() => resolver.resolve("C:\\Owner\\secret")).toThrow("WORKER_REPOSITORY_ALIAS_INVALID");
    expect(() => resolver.resolve("..\\secret")).toThrow("WORKER_REPOSITORY_ALIAS_INVALID");
    expect(() => resolver.resolve("missing")).toThrow("WORKER_REPOSITORY_NOT_ALLOWED");
  });

  it("rejects configured mappings outside the allowed root and symlink escapes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-root-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "piltover-p4-outside-"));
    roots.push(root, outside);
    expect(() => new LocalRepositoryResolver(root, { bad: outside })).toThrow("WORKER_REPOSITORY_PATH_ESCAPE");

    const link = path.join(root, "linked");
    try {
      fs.symlinkSync(outside, link, "junction");
      expect(() => new LocalRepositoryResolver(root, { linked: link })).toThrow("WORKER_REPOSITORY_PATH_ESCAPE");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    }
  });
});
