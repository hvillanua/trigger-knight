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
    expect(parseAssetTreatment("swinir-2x")).toEqual({
      id: "swinir-2x",
      directory: "swinir-2x",
      filtering: "linear",
    });
    expect(assetTreatmentForPreference("swinir-2x").id).toBe("swinir-2x");
  });

  it("lets a development override replace the saved preference", () => {
    expect(visualPreferenceFromStartup("swinir-2x", undefined)).toBe(
      "swinir-2x",
    );
    expect(visualPreferenceFromStartup("swinir-2x", "original")).toBe(
      "original",
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
