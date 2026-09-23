import { describe, expect, it } from "vitest";

import {
  ORIGINAL_ASSET_TREATMENT,
  parseAssetTreatment,
} from "../../src/browser/asset-treatment.js";

describe("asset treatment selection", () => {
  it("uses filtered original artwork by default", () => {
    expect(parseAssetTreatment(undefined)).toBe(ORIGINAL_ASSET_TREATMENT);
    expect(parseAssetTreatment("")).toBe(ORIGINAL_ASSET_TREATMENT);
  });

  it("resolves a generated treatment and its renderer filtering", () => {
    expect(parseAssetTreatment("realesrgan-4x")).toEqual({
      id: "realesrgan-4x",
      directory: "realesrgan-4x",
      filtering: "linear",
    });
    expect(parseAssetTreatment("ffdec-2x").filtering).toBe("nearest");
  });

  it("rejects values outside the supported treatment set", () => {
    expect(() => parseAssetTreatment("unknown-treatment")).toThrow(
      "Unknown VITE_ASSET_TREATMENT: unknown-treatment",
    );
    expect(() => parseAssetTreatment(4)).toThrow(
      "VITE_ASSET_TREATMENT must be a supported treatment id",
    );
  });
});
