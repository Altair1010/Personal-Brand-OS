export interface FeatureFlagDefinition<Key extends string = string> {
  readonly key: Key;
  readonly owner: string;
  readonly purpose: string;
  readonly default: boolean;
  readonly removalCondition: string;
}

const REQUIRED_TEXT_FIELDS = ["key", "owner", "purpose", "removalCondition"] as const;

export function defineFeatureFlag<const Key extends string>(
  definition: FeatureFlagDefinition<Key>,
): Readonly<FeatureFlagDefinition<Key>> {
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof definition[field] !== "string" || definition[field].trim().length === 0) {
      throw new TypeError(`Feature flag ${field} must not be empty.`);
    }
  }
  if (typeof definition.default !== "boolean") {
    throw new TypeError("Feature flag default must be a boolean.");
  }

  return Object.freeze({ ...definition });
}

export function resolveFeatureFlag<Key extends string>(
  key: string,
  definitions: readonly FeatureFlagDefinition<Key>[],
  overrides: Readonly<Record<string, boolean | undefined>> = {},
): boolean {
  const matchingDefinitions = definitions.filter((definition) => definition.key === key);
  if (matchingDefinitions.length === 0) throw new Error(`Unknown feature flag "${key}".`);
  if (matchingDefinitions.length > 1) throw new Error(`Duplicate feature flag "${key}".`);

  if (Object.hasOwn(overrides, key)) {
    const override = overrides[key];
    if (typeof override !== "boolean") {
      throw new TypeError(`Feature flag override "${key}" must be a boolean.`);
    }
    return override;
  }

  return matchingDefinitions[0].default;
}
