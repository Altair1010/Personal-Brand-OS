import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isErrorEnvelope,
  isPiltoverErrorCode,
  type ErrorEnvelope,
} from "@/lib/piltover/shared/contracts/error-envelope";

describe("ErrorEnvelope", () => {
  it("represents the required canonical fields without requiring details", () => {
    const envelope: ErrorEnvelope = {
      code: "VALIDATION_FAILED",
      message: "The request is invalid.",
      retryable: false,
      correlationId: "corr-123",
    };

    expectTypeOf(envelope.code).toBeString();
    expect(isErrorEnvelope(envelope)).toBe(true);
  });

  it("accepts optional JSON-safe structured details", () => {
    expect(
      isErrorEnvelope({
        code: "WORKER_OFFLINE",
        message: "No worker is available.",
        retryable: true,
        correlationId: "corr-456",
        details: { attempts: 2, regions: ["local"], lastSeenAt: null },
      }),
    ).toBe(true);
  });

  it.each(["validation_failed", "UNKNOWN_FAILURE", "AUTH_", "AUTH-FAILED", 42])(
    "rejects non-canonical error code %j",
    (code) => {
      expect(isPiltoverErrorCode(code)).toBe(false);
    },
  );

  it("rejects non-JSON details and additional envelope properties", () => {
    expect(
      isErrorEnvelope({
        code: "INTERNAL_FAILURE",
        message: "Internal failure.",
        retryable: false,
        correlationId: "corr-789",
        details: { observedAt: new Date() },
      }),
    ).toBe(false);

    expect(
      isErrorEnvelope({
        code: "INTERNAL_FAILURE",
        message: "Internal failure.",
        retryable: false,
        correlationId: "corr-789",
        status: 500,
      }),
    ).toBe(false);
  });
});
