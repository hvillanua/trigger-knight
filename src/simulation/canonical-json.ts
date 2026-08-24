import { createHash } from "node:crypto";

export type CanonicalJsonValue =
  | boolean
  | number
  | string
  | null
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

function normalizeValue(
  value: unknown,
  ancestors: ReadonlySet<object>,
): CanonicalJsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON numbers must be finite");
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (typeof value !== "object") {
    throw new TypeError("Canonical JSON contains an unsupported value");
  }

  if (ancestors.has(value)) {
    throw new TypeError("Canonical JSON cannot contain cycles");
  }

  const nestedAncestors = new Set(ancestors);
  nestedAncestors.add(value);

  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => normalizeValue(item, nestedAncestors)),
    );
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Canonical JSON objects must be plain records");
  }

  const normalized: Record<string, CanonicalJsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeValue(
      (value as Record<string, unknown>)[key],
      nestedAncestors,
    );
  }

  return Object.freeze(normalized);
}

/** Copies, sorts, and freezes one JSON-compatible value. */
export function normalizeCanonicalJson(value: unknown): CanonicalJsonValue {
  return normalizeValue(value, new Set());
}

/** Serializes one value with recursively sorted object keys. */
export function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalJson(value));
}

function formatHash(hash: string): string {
  return `sha256-v1:${hash}`;
}

/** Produces a versioned hash of one canonical JSON value. */
export function fingerprintCanonicalJson(value: unknown): string {
  const hash = createHash("sha256")
    .update(stringifyCanonicalJson(value), "utf8")
    .digest("hex");

  return formatHash(hash);
}

export interface CanonicalTraceHasher {
  add(value: unknown): void;
  digest(): string;
}

/** Hashes a sequence of length-delimited canonical JSON records. */
export function createCanonicalTraceHasher(): CanonicalTraceHasher {
  const hash = createHash("sha256");
  let digest: string | undefined;

  return Object.freeze({
    add(value: unknown): void {
      if (digest !== undefined) {
        throw new Error("Cannot add records after reading a trace digest");
      }

      const record = stringifyCanonicalJson(value);
      hash.update(`${record.length}:`, "utf8");
      hash.update(record, "utf8");
    },
    digest(): string {
      digest ??= formatHash(hash.digest("hex"));
      return digest;
    },
  });
}
