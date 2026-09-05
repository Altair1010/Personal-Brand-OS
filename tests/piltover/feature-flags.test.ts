import { describe, expect, it } from "vitest";
import {
  defineFeatureFlag,
  resolveFeatureFlag,
} from "@/lib/piltover/shared/architecture/feature-flags";

const exampleFlag = defineFeatureFlag({
  key: "example_capability_enabled",
  owner: "P1 test owner",
  purpose: "Prove deterministic feature-flag resolution.",
  default: false,
  removalCondition: "Remove when the example capability is permanently enabled or retired.",
});

describe("feature flags", () => {
  it("preserves required governance metadata", () => {
    expect(exampleFlag).toEqual({
      key: "example_capability_enabled",
      owner: "P1 test owner",
      purpose: "Prove deterministic feature-flag resolution.",
      default: false,
      removalCondition: "Remove when the example capability is permanently enabled or retired.",
    });
  });

  it("uses the deterministic default when no override exists", () => {
    expect(resolveFeatureFlag("example_capability_enabled", [exampleFlag])).toBe(false);
  });

  it("uses an explicit boolean override", () => {
    expect(
      resolveFeatureFlag("example_capability_enabled", [exampleFlag], {
        example_capability_enabled: true,
      }),
    ).toBe(true);
  });

  it("fails closed for an unknown key", () => {
    expect(() => resolveFeatureFlag("missing_flag", [exampleFlag])).toThrowError(
      'Unknown feature flag "missing_flag".',
    );
  });

  it("rejects incomplete governance metadata", () => {
    expect(() =>
      defineFeatureFlag({
        key: "invalid_flag",
        owner: "",
        purpose: "Test invalid metadata.",
        default: false,
        removalCondition: "Remove after the test.",
      }),
    ).toThrowError("Feature flag owner must not be empty.");
  });
});
