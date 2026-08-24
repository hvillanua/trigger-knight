import { createHash } from "node:crypto";

export type { CanonicalJsonValue } from "../application/canonical-json.js";
export {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "../application/canonical-json.js";
import { stringifyCanonicalJson } from "../application/canonical-json.js";

function formatHash(hash: string): string {
  return `sha256-v1:${hash}`;
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
