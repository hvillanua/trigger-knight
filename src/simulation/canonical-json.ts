const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

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

function updateHash(hash: number, text: string): number {
  let updated = hash;

  for (const byte of new TextEncoder().encode(text)) {
    updated = Math.imul(updated ^ byte, FNV_PRIME) >>> 0;
  }

  return updated;
}

function formatHash(hash: number): string {
  return `fnv1a32-v1:${hash.toString(16).padStart(8, "0")}`;
}

/** Produces a versioned hash of one canonical JSON value. */
export function fingerprintCanonicalJson(value: unknown): string {
  return formatHash(
    updateHash(FNV_OFFSET_BASIS, stringifyCanonicalJson(value)),
  );
}

export interface CanonicalTraceHasher {
  add(value: unknown): void;
  digest(): string;
}

/** Hashes a sequence of length-delimited canonical JSON records. */
export function createCanonicalTraceHasher(): CanonicalTraceHasher {
  let hash = FNV_OFFSET_BASIS;

  return Object.freeze({
    add(value: unknown): void {
      const record = stringifyCanonicalJson(value);
      hash = updateHash(hash, `${record.length}:`);
      hash = updateHash(hash, record);
    },
    digest(): string {
      return formatHash(hash);
    },
  });
}
