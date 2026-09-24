export type AssetTreatmentId =
  | "original-filtered"
  | "original-nearest"
  | "ffdec-2x"
  | "ffdec-4x"
  | "lanczos-4x"
  | "ai-4x"
  | "esrgan-2x"
  | "esrgan-4x"
  | "realesrgan-2x"
  | "realesrgan-4x"
  | "realesrgan-anime-2x"
  | "realesrgan-anime-4x"
  | "srgan-2x"
  | "srgan-4x"
  | "swinir-2x"
  | "swinir-4x";

export type ImageFiltering = "linear" | "nearest";

export interface AssetTreatment {
  readonly id: AssetTreatmentId;
  readonly directory: string | undefined;
  readonly filtering: ImageFiltering;
}

function isAssetTreatmentId(value: string): value is AssetTreatmentId {
  return Object.hasOwn(ASSET_TREATMENTS, value);
}

const ASSET_TREATMENTS: Readonly<Record<AssetTreatmentId, AssetTreatment>> =
  Object.freeze({
    "original-filtered": Object.freeze({
      id: "original-filtered",
      directory: undefined,
      filtering: "linear",
    }),
    "original-nearest": Object.freeze({
      id: "original-nearest",
      directory: undefined,
      filtering: "nearest",
    }),
    "ffdec-2x": Object.freeze({
      id: "ffdec-2x",
      directory: "ffdec-2x",
      filtering: "nearest",
    }),
    "ffdec-4x": Object.freeze({
      id: "ffdec-4x",
      directory: "ffdec-4x",
      filtering: "nearest",
    }),
    "lanczos-4x": Object.freeze({
      id: "lanczos-4x",
      directory: "lanczos-4x",
      filtering: "linear",
    }),
    "ai-4x": Object.freeze({
      id: "ai-4x",
      directory: "ai-4x",
      filtering: "linear",
    }),
    "esrgan-2x": Object.freeze({
      id: "esrgan-2x",
      directory: "esrgan-2x",
      filtering: "linear",
    }),
    "esrgan-4x": Object.freeze({
      id: "esrgan-4x",
      directory: "esrgan-4x",
      filtering: "linear",
    }),
    "realesrgan-2x": Object.freeze({
      id: "realesrgan-2x",
      directory: "realesrgan-2x",
      filtering: "linear",
    }),
    "realesrgan-4x": Object.freeze({
      id: "realesrgan-4x",
      directory: "realesrgan-4x",
      filtering: "linear",
    }),
    "realesrgan-anime-2x": Object.freeze({
      id: "realesrgan-anime-2x",
      directory: "realesrgan-anime-2x",
      filtering: "linear",
    }),
    "realesrgan-anime-4x": Object.freeze({
      id: "realesrgan-anime-4x",
      directory: "realesrgan-anime-4x",
      filtering: "linear",
    }),
    "srgan-2x": Object.freeze({
      id: "srgan-2x",
      directory: "srgan-2x",
      filtering: "linear",
    }),
    "srgan-4x": Object.freeze({
      id: "srgan-4x",
      directory: "srgan-4x",
      filtering: "linear",
    }),
    "swinir-2x": Object.freeze({
      id: "swinir-2x",
      directory: "swinir-2x",
      filtering: "linear",
    }),
    "swinir-4x": Object.freeze({
      id: "swinir-4x",
      directory: "swinir-4x",
      filtering: "linear",
    }),
  });

export const ORIGINAL_ASSET_TREATMENT = ASSET_TREATMENTS["original-filtered"];

export function parseAssetTreatment(value: unknown): AssetTreatment {
  if (value === undefined || value === "") return ORIGINAL_ASSET_TREATMENT;
  if (typeof value !== "string") {
    throw new Error("VITE_ASSET_TREATMENT must be a supported treatment id");
  }
  if (!isAssetTreatmentId(value)) {
    throw new Error(`Unknown VITE_ASSET_TREATMENT: ${value}`);
  }
  return ASSET_TREATMENTS[value];
}
