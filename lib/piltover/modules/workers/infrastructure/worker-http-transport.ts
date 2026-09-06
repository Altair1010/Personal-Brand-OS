import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { AuthenticatedWorkerPrincipal } from "../../../shared/ports/worker-bridge-ports";

interface Authenticator {
  authenticate(credential: string): Promise<AuthenticatedWorkerPrincipal>;
}

export interface WorkerHttpPolicy {
  readonly enabled: boolean;
  readonly maxBodyBytes: number;
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ code, message, retryable: status >= 500, correlationId: randomUUID() }, status);
}

function mappedError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message.split(":", 1)[0] : "INTERNAL_UNEXPECTED";
  if (code.startsWith("AUTH_")) return error(code, "Worker authentication failed.", 401);
  if (code.startsWith("VALIDATION_") || code.endsWith("_INVALID")) return error(code, "The request is invalid.", 400);
  if (code.includes("NOT_FOUND")) return error(code, "The requested resource was not found.", 404);
  if (code.startsWith("WORKER_") || code.startsWith("TENANT_") || code.startsWith("PERMISSION_")) {
    return error(code, "The Worker is not authorized for this operation.", 403);
  }
  if (code.startsWith("QUEUE_") || code.startsWith("AGENT_")) return error(code, "The operation conflicts with canonical state.", 409);
  return error("INTERNAL_UNEXPECTED", "The request could not be completed.", 500);
}

export async function handleAuthenticatedWorkerRequest<S extends z.ZodTypeAny, Output>(
  request: Request,
  schema: S,
  credentials: Authenticator,
  handler: (principal: AuthenticatedWorkerPrincipal, body: z.infer<S>) => Promise<Output>,
  policy: WorkerHttpPolicy,
): Promise<Response> {
  if (!policy.enabled) return error("WORKER_TRANSPORT_DISABLED", "Worker transport is disabled.", 404);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length <= 7) {
    return error("AUTH_REQUIRED", "Worker authentication is required.", 401);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > policy.maxBodyBytes) {
    return error("VALIDATION_BODY_TOO_LARGE", "The request body is too large.", 413);
  }
  try {
    const principal = await credentials.authenticate(authorization.slice(7));
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > policy.maxBodyBytes) {
      return error("VALIDATION_BODY_TOO_LARGE", "The request body is too large.", 413);
    }
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { return error("VALIDATION_JSON_INVALID", "The request body is invalid JSON.", 400); }
    const parsed = schema.safeParse(decoded);
    if (!parsed.success) return error("VALIDATION_REQUEST_INVALID", "The request body does not match the contract.", 400);
    return json(await handler(principal, parsed.data), 200);
  } catch (cause) {
    return mappedError(cause);
  }
}
