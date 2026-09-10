import type {
  PolicyConfig,
  PolicyDescriptor,
} from "../application/contracts.js";
import {
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "./canonical-json.js";

type NormalizedRecord = Readonly<Record<string, unknown>>;

function record(value: unknown, label: string): NormalizedRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }

  return value as NormalizedRecord;
}

function assertKeys(
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

/** Copies and validates one normalized policy descriptor from JSON input. */
export function normalizePolicyDescriptor(input: unknown): PolicyDescriptor {
  const normalized = record(normalizeCanonicalJson(input), "Policy descriptor");
  assertKeys(normalized, ["config", "id", "version"], "Policy descriptor");

  if (typeof normalized.id !== "string" || normalized.id.length === 0) {
    throw new TypeError("Policy descriptor id must be a non-empty string");
  }

  if (
    typeof normalized.version !== "string" ||
    normalized.version.length === 0
  ) {
    throw new TypeError("Policy descriptor version must be a non-empty string");
  }

  const config = record(normalized.config, "Policy descriptor config");

  return Object.freeze({
    id: normalized.id,
    version: normalized.version,
    config: config as PolicyConfig,
  });
}

/** Returns the canonical serialized identity of a policy descriptor. */
export function stringifyPolicyDescriptor(input: unknown): string {
  return stringifyCanonicalJson(normalizePolicyDescriptor(input));
}
