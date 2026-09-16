import { normalizeProfile } from "../domain/profile.js";
import type { ProfileInput } from "../domain/contracts.js";
import { normalizeCanonicalJson } from "../application/canonical-json.js";

export type NormalizedRecord = Readonly<Record<string, unknown>>;

/** Checks the small record shape shared by serializable simulation inputs. */
export function record(value: unknown, label: string): NormalizedRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }

  return value as NormalizedRecord;
}

/** Rejects missing or unknown fields for an exact serialized envelope. */
export function assertExactKeys(
  value: NormalizedRecord,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

/** Checks required fields while allowing an explicit, small optional set. */
export function assertKeys(
  value: NormalizedRecord,
  expected: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  const missing = sortedExpected.filter((key) => !actual.includes(key));
  if (missing.length > 0) {
    throw new TypeError(
      `${label} is missing required fields: ${missing.join(", ")}`,
    );
  }

  const allowed = new Set([...expected, ...optional]);
  if (actual.some((key) => !allowed.has(key))) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

/** Copies and validates one profile input for a headless simulation boundary. */
export function normalizeProfileInput(input: unknown): ProfileInput {
  const normalized = normalizeCanonicalJson(input);
  normalizeProfile(normalized);
  return normalized as unknown as ProfileInput;
}

/** Validates a positive safe integer shared by finite simulation boundaries. */
export function positiveSafeInteger(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }

  return input;
}
