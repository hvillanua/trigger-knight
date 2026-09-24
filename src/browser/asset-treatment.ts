import type { VisualAssetPreference } from "../application/settings.js";

export type AssetTreatmentId = "original-filtered" | "swinir-2x";

export type ImageFiltering = "linear";

export interface AssetTreatment {
  readonly id: AssetTreatmentId;
  readonly directory: string | undefined;
  readonly filtering: ImageFiltering;
}

const ASSET_TREATMENTS: Readonly<Record<AssetTreatmentId, AssetTreatment>> =
  Object.freeze({
    "original-filtered": Object.freeze({
      id: "original-filtered",
      directory: undefined,
      filtering: "linear",
    }),
    "swinir-2x": Object.freeze({
      id: "swinir-2x",
      directory: "swinir-2x",
      filtering: "linear",
    }),
  });

export const ORIGINAL_ASSET_TREATMENT = ASSET_TREATMENTS["original-filtered"];

export function assetTreatmentForPreference(
  preference: VisualAssetPreference,
): AssetTreatment {
  switch (preference) {
    case "original":
      return ORIGINAL_ASSET_TREATMENT;
    case "swinir-2x":
      return ASSET_TREATMENTS["swinir-2x"];
  }
}

export function visualPreferenceFromStartup(
  saved: VisualAssetPreference,
  override: unknown,
): VisualAssetPreference {
  if (override === undefined || override === "") return saved;
  if (override === "original" || override === "original-filtered") {
    return "original";
  }
  if (override === "swinir-2x") return "swinir-2x";
  if (typeof override !== "string") {
    throw new Error("VITE_ASSET_TREATMENT must be a supported treatment id");
  }
  throw new Error(`Unknown VITE_ASSET_TREATMENT: ${override}`);
}

export function parseAssetTreatment(value: unknown): AssetTreatment {
  return assetTreatmentForPreference(
    visualPreferenceFromStartup("original", value),
  );
}
