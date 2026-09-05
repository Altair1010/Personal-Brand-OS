export const ERROR_CODE_PREFIXES = [
  "AUTH",
  "PERMISSION",
  "VALIDATION",
  "TENANT",
  "DB",
  "MIGRATION",
  "STORAGE",
  "QUEUE",
  "WORKER",
  "CODEX",
  "MCP",
  "AGENT",
  "APPROVAL",
  "META",
  "GITHUB",
  "INTERNAL",
] as const;

export type ErrorCodePrefix = (typeof ERROR_CODE_PREFIXES)[number];
export type PiltoverErrorCode = `${ErrorCodePrefix}_${string}`;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface ErrorEnvelope {
  readonly code: PiltoverErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly correlationId: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

const ERROR_ENVELOPE_KEYS = new Set([
  "code",
  "message",
  "retryable",
  "correlationId",
  "details",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors: Set<object>): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : isPlainObject(value) && Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

export function isPiltoverErrorCode(value: unknown): value is PiltoverErrorCode {
  if (typeof value !== "string") return false;
  const match = /^([A-Z]+)_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.exec(value);
  return Boolean(
    match && ERROR_CODE_PREFIXES.includes(match[1] as (typeof ERROR_CODE_PREFIXES)[number]),
  );
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).some((key) => !ERROR_ENVELOPE_KEYS.has(key))) return false;

  return (
    isPiltoverErrorCode(value.code) &&
    typeof value.message === "string" &&
    value.message.trim().length > 0 &&
    typeof value.retryable === "boolean" &&
    typeof value.correlationId === "string" &&
    value.correlationId.trim().length > 0 &&
    (!("details" in value) ||
      (isPlainObject(value.details) && isJsonValue(value.details, new Set())))
  );
}
