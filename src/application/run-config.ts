import type {
  MinimalProfileInput,
  ProfileInput,
  RuleSetId,
} from "../domain/contracts.js";
import { normalizeProfile } from "../domain/profile.js";
import {
  normalizeCanonicalJson,
  type CanonicalJsonValue,
} from "./canonical-json.js";

export interface RunConfig {
  readonly ruleset: RuleSetId;
  readonly seed: string;
  readonly initialProfile: ProfileInput;
  /** Optional startup behavior for a newly created run. */
  readonly startImmediately?: boolean;
}

type CanonicalRecord = Readonly<Record<string, CanonicalJsonValue>>;

function record(value: CanonicalJsonValue, label: string): CanonicalRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }
  return value as CanonicalRecord;
}

function assertRunConfigKeys(value: CanonicalRecord): void {
  const expected = ["initialProfile", "ruleset", "seed"];
  const optional = "startImmediately";
  const keys = Object.keys(value);
  if (
    keys.length < expected.length ||
    expected.some((key) => !Object.hasOwn(value, key)) ||
    keys.some((key) => key !== optional && !expected.includes(key))
  ) {
    throw new TypeError("Run config contains unsupported or missing fields");
  }
}

/** Copies and validates a minimal or expanded profile without changing its shape. */
export function normalizeProfileInput(input: unknown): ProfileInput {
  const normalized = normalizeCanonicalJson(input);
  const inputRecord = record(normalized, "Profile");
  const isMinimal = inputRecord.schemaVersion === 1;
  const profile = normalizeProfile(inputRecord);
  if (!isMinimal) {
    return profile;
  }
  const minimal: MinimalProfileInput = {
    schemaVersion: 1,
    scoreMultiplier: profile.scoreMultiplier,
  };
  return Object.hasOwn(inputRecord, "tutorialPreference")
    ? Object.freeze({
        ...minimal,
        tutorialPreference: profile.tutorialPreference,
      })
    : Object.freeze(minimal);
}

/** Copies and validates a run configuration at an application boundary. */
export function normalizeRunConfig(input: unknown): RunConfig {
  const normalized = record(normalizeCanonicalJson(input), "Run config");
  assertRunConfigKeys(normalized);

  if (
    typeof normalized.ruleset !== "string" ||
    normalized.ruleset.length === 0
  ) {
    throw new TypeError("Run config ruleset must be a non-empty string");
  }
  if (typeof normalized.seed !== "string") {
    throw new TypeError("Run config seed must be a string");
  }
  if (
    normalized.startImmediately !== undefined &&
    typeof normalized.startImmediately !== "boolean"
  ) {
    throw new TypeError("Run config startImmediately must be a boolean");
  }

  return Object.freeze({
    ruleset: normalized.ruleset,
    seed: normalized.seed,
    initialProfile: normalizeProfileInput(normalized.initialProfile),
    ...(normalized.startImmediately === undefined
      ? {}
      : { startImmediately: normalized.startImmediately }),
  });
}
