import type { VisualAssetPreference } from "../application/settings.js";

export type AssetTreatmentId = "original-filtered" | "high-res";

export type ImageFiltering = "linear" | "nearest";

export const HIGH_RESOLUTION_ASSET_DIRECTORY = "high-res";

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
    "high-res": Object.freeze({
      id: "high-res",
      directory: HIGH_RESOLUTION_ASSET_DIRECTORY,
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
    case "high-res":
      return ASSET_TREATMENTS["high-res"];
  }
}

export function assetTreatmentForHighResolution(
  filtering: ImageFiltering,
): AssetTreatment {
  const defaultTreatment = ASSET_TREATMENTS["high-res"];
  if (filtering === defaultTreatment.filtering) return defaultTreatment;
  return Object.freeze({ ...defaultTreatment, filtering });
}

export function visualPreferenceFromStartup(
  saved: VisualAssetPreference,
  override: unknown,
): VisualAssetPreference {
  if (override === undefined || override === "") return saved;
  if (override === "original" || override === "original-filtered") {
    return "original";
  }
  if (override === "high-res" || override === "swinir-2x") {
    return "high-res";
  }
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
