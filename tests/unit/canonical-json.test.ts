import { describe, expect, it } from "vitest";

import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "../../src/simulation/canonical-json.js";

describe("canonical JSON", () => {
  it("distinguishes records that collide under the former 32-bit fingerprint", () => {
    expect(
      fingerprintCanonicalJson({
        schemaVersion: 1,
        scoreMultiplier: 1,
        nonce: 51_828,
      }),
    ).not.toBe(
      fingerprintCanonicalJson({
        schemaVersion: 1,
        scoreMultiplier: 1,
        nonce: 301_880,
      }),
    );
  });
  it.each(["retained", { nested: true }])(
    "preserves an own __proto__ key with value %j",
    (protoValue) => {
      const serialized = `{"__proto__":${JSON.stringify(protoValue)},"safe":true}`;
      const withProtoKey = JSON.parse(serialized) as unknown;

      expect(stringifyCanonicalJson(withProtoKey)).toBe(serialized);
      expect(fingerprintCanonicalJson(withProtoKey)).not.toBe(
        fingerprintCanonicalJson({ safe: true }),
      );
    },
  );

  it("preserves JSON.stringify ordering for integer-index object keys", () => {
    const value = { "10": "ten", "2": "two", alpha: true };

    expect(stringifyCanonicalJson(value)).toBe(
      '{"2":"two","10":"ten","alpha":true}',
    );
    expect(stringifyCanonicalJson(value)).toBe(
      JSON.stringify(normalizeCanonicalJson(value)),
    );
  });

  it("rejects sparse arrays", () => {
    const sparse = new Array<unknown>(1);

    expect(() => stringifyCanonicalJson(sparse)).toThrowError(
      "Canonical JSON arrays cannot contain holes",
    );
  });
});
