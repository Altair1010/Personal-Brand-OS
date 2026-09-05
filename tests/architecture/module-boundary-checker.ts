import path from "node:path";

export type PiltoverLayer = "domain" | "application" | "infrastructure";

export interface BoundaryViolation {
  readonly filePath: string;
  readonly importSource: string;
  readonly rule: "domain-provider" | "layer-direction";
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:type\s+)?(?:[^\n;"']*?\s+from\s+)?["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
] as const;

const DOMAIN_PROVIDER_IMPORTS = [
  /^(?:next)(?:\/|$)/,
  /^@prisma\/client(?:\/|$)/,
  /^@supabase\//,
  /^(?:@libsql\/|@turso\/|libsql(?:\/|$))/,
  /^(?:@modelcontextprotocol\/|mcp-transport(?:\/|$))/,
  /^(?:@openai\/codex|codex-app-server)(?:\/|$)/,
  /^(?:@meta\/|facebook-nodejs-business-sdk(?:\/|$))/,
  /^@\/lib\/(?:auth|cloud-backup|db|facebook|supabase-config)(?:\/|$)/,
] as const;

function normalize(value: string): string {
  return value.replaceAll("\\", "/");
}

function layerFromPath(filePath: string): PiltoverLayer | undefined {
  return normalize(filePath).match(
    /\/modules\/[^/]+\/(domain|application|infrastructure)(?:\/|$)/,
  )?.[1] as PiltoverLayer | undefined;
}

function importedLayer(filePath: string, importSource: string): PiltoverLayer | undefined {
  const normalizedSource = normalize(importSource);
  const resolved = normalizedSource.startsWith(".")
    ? normalize(path.posix.resolve(path.posix.dirname(normalize(filePath)), normalizedSource))
    : normalizedSource;

  return resolved.match(/\/(domain|application|infrastructure)(?:\/|$)/)?.[1] as
    | PiltoverLayer
    | undefined;
}

export function extractImportSources(source: string): readonly string[] {
  const imports = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      imports.add(match[1]);
    }
  }

  return [...imports];
}

export function findBoundaryViolations(
  filePath: string,
  source: string,
): readonly BoundaryViolation[] {
  const importerLayer = layerFromPath(filePath);
  if (!importerLayer) return [];

  const violations: BoundaryViolation[] = [];

  for (const importSource of extractImportSources(source)) {
    if (
      importerLayer === "domain" &&
      DOMAIN_PROVIDER_IMPORTS.some((pattern) => pattern.test(importSource))
    ) {
      violations.push({ filePath, importSource, rule: "domain-provider" });
    }

    const targetLayer = importedLayer(filePath, importSource);
    const violatesDirection =
      (importerLayer === "domain" &&
        (targetLayer === "application" || targetLayer === "infrastructure")) ||
      (importerLayer === "application" && targetLayer === "infrastructure");

    if (violatesDirection) {
      violations.push({ filePath, importSource, rule: "layer-direction" });
    }
  }

  return violations;
}
