import { describe, expect, it } from "vitest";

import {
  assetTreatmentForPreference,
  ORIGINAL_ASSET_TREATMENT,
  parseAssetTreatment,
  visualPreferenceFromStartup,
} from "../../src/browser/asset-treatment.js";

describe("asset treatment selection", () => {
  it("uses filtered original artwork by default", () => {
    expect(parseAssetTreatment(undefined)).toBe(ORIGINAL_ASSET_TREATMENT);
    expect(parseAssetTreatment("")).toBe(ORIGINAL_ASSET_TREATMENT);
  });

  it("resolves the two supported visual preferences", () => {
    expect(parseAssetTreatment("original")).toBe(ORIGINAL_ASSET_TREATMENT);
    expect(parseAssetTreatment("original-filtered")).toBe(
      ORIGINAL_ASSET_TREATMENT,
    );
    expect(parseAssetTreatment("high-res")).toEqual({
      id: "high-res",
      directory: "high-res",
      filtering: "linear",
    });
    expect(assetTreatmentForPreference("high-res").id).toBe("high-res");
    expect(parseAssetTreatment("swinir-2x").id).toBe("high-res");
  });

  it("lets a development override replace the saved preference", () => {
    expect(visualPreferenceFromStartup("high-res", undefined)).toBe("high-res");
    expect(visualPreferenceFromStartup("high-res", "original")).toBe(
      "original",
    );
    expect(visualPreferenceFromStartup("high-res", "swinir-2x")).toBe(
      "high-res",
    );
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
