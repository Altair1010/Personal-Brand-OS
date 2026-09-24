import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { beginProviderOAuth, type ProviderKind } from "@/lib/piltover/providers/connection-service";
import { ensureDefaultProviderAdapters } from "@/lib/piltover/providers/register-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerMap: Record<string, ProviderKind> = {
  meta: "META",
  linkedin: "LINKEDIN",
  google_search_console: "GOOGLE_SEARCH_CONSOLE",
  "google-search-console": "GOOGLE_SEARCH_CONSOLE",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  ensureDefaultProviderAdapters();
  const { provider: raw } = await context.params;
  const provider = providerMap[raw.toLowerCase()];
  if (!provider) {
    return NextResponse.json({ ok: false, error: "PROVIDER_NOT_SUPPORTED" }, { status: 404 });
  }
  try {
    const result = await beginProviderOAuth(db, provider);
    if (request.nextUrl.searchParams.get("mode") === "json") {
      return NextResponse.json({ ok: true, data: result });
    }
    return NextResponse.redirect(result.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROVIDER_CONNECT_FAILED";
    if (request.nextUrl.searchParams.get("mode") === "json") {
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    const target = new URL("/settings", request.nextUrl.origin);
    target.searchParams.set("providerError", message);
    return NextResponse.redirect(target);
  }
}
