import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findBoundaryViolations } from "./module-boundary-checker";

const PILTOVER_ROOT = path.resolve(process.cwd(), "lib/piltover");
const MODULE_NAMES = [
  "identity",
  "brands",
  "evidence",
  "content",
  "work",
  "approvals",
  "agents",
  "workers",
  "learning",
  "integrations",
  "audit",
  "platform",
] as const;

function sourceFilesWithin(root: string): readonly string[] {
  if (!fs.existsSync(root)) return [];

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFilesWithin(entryPath);
    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("Piltover module boundaries", () => {
  it("allows application code to import domain code", () => {
    const source = 'import type { Draft } from "../domain/draft";';

    expect(
      findBoundaryViolations(
        "lib/piltover/modules/content/application/create-draft.ts",
        source,
      ),
    ).toEqual([]);
  });

  it("rejects provider imports from domain code", () => {
    const source = 'import { PrismaClient } from "@prisma/client";';

    expect(
      findBoundaryViolations("lib/piltover/modules/brands/domain/brand.ts", source),
    ).toEqual([
      {
        filePath: "lib/piltover/modules/brands/domain/brand.ts",
        importSource: "@prisma/client",
        rule: "domain-provider",
      },
    ]);
  });

  it("rejects provider imports from shared contracts and ports", () => {
    const source = 'import type { Prisma } from "@prisma/client";';

    expect(
      findBoundaryViolations("lib/piltover/shared/contracts/error-envelope.ts", source),
    ).toContainEqual({
      filePath: "lib/piltover/shared/contracts/error-envelope.ts",
      importSource: "@prisma/client",
      rule: "domain-provider",
    });
  });

  it.each([
    [
      "domain",
      "lib/piltover/modules/content/domain/publication.ts",
      'import { save } from "../infrastructure/publication-store";',
    ],
    [
      "application",
      "lib/piltover/modules/content/application/publish.ts",
      'import { publish } from "../infrastructure/meta-publisher";',
    ],
  ])("rejects %s imports that point inward to infrastructure", (_layer, filePath, source) => {
    expect(findBoundaryViolations(filePath, source)).toContainEqual({
      filePath,
      importSource: expect.stringContaining("infrastructure"),
      rule: "layer-direction",
    });
  });

  it("keeps every canonical module root tracked and the actual Piltover tree legal", () => {
    for (const moduleName of MODULE_NAMES) {
      expect(fs.existsSync(path.join(PILTOVER_ROOT, "modules", moduleName))).toBe(true);
    }

    const violations = sourceFilesWithin(PILTOVER_ROOT).flatMap((filePath) =>
      findBoundaryViolations(filePath, fs.readFileSync(filePath, "utf8")),
    );

    expect(violations).toEqual([]);
  });
});
