export type ImageFiltering = "linear";

export interface AssetTreatment {
  readonly id: "original-filtered";
  readonly directory: undefined;
  readonly filtering: ImageFiltering;
}

export const ORIGINAL_ASSET_TREATMENT: AssetTreatment = Object.freeze({
  id: "original-filtered",
  directory: undefined,
  filtering: "linear",
});
