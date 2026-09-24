import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeProviderOAuth, failProviderOAuthAttempt, type ProviderKind, redactProviderError } from "@/lib/piltover/providers/connection-service";
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
  const state = request.nextUrl.searchParams.get("state") || "";
  const code = request.nextUrl.searchParams.get("code") || "";
  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorDescription = request.nextUrl.searchParams.get("error_description");
  const target = new URL("/settings", request.nextUrl.origin);

  if (!provider) {
    target.searchParams.set("providerError", "PROVIDER_NOT_SUPPORTED");
    return NextResponse.redirect(target);
  }
  if (providerError) {
    if (state) {
      await failProviderOAuthAttempt(db, {
        provider,
        state,
        error: providerErrorDescription || providerError,
      }).catch(() => undefined);
    }
    target.searchParams.set("providerError", redactProviderError(providerErrorDescription || providerError));
    return NextResponse.redirect(target);
  }
  if (!state || !code) {
    target.searchParams.set("providerError", "OAUTH_CALLBACK_INCOMPLETE");
    return NextResponse.redirect(target);
  }

  try {
    const connection = await completeProviderOAuth(db, { provider, state, code });
    target.searchParams.set("providerConnected", connection.provider);
    return NextResponse.redirect(target);
  } catch (error) {
    target.searchParams.set("providerError", redactProviderError(error));
    return NextResponse.redirect(target);
  }
}
