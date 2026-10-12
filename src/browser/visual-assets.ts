import ORIGINAL_ASSET_URLS from "virtual:trigger-knight/original-assets";
import {
  ORIGINAL_ASSET_TREATMENT,
  type AssetTreatment,
} from "./asset-treatment.js";

export type PixelDensity = 1 | 2 | 4;

export interface VisualImageSource {
  readonly url: string;
  readonly pixelDensity: PixelDensity;
}

export interface VisualAssetPack {
  readonly treatment: AssetTreatment;
  image(originalPath: string): VisualImageSource;
}

const ORIGINAL_IMAGE_ROOT = "../assets/original/";

function originalImageUrl(path: string): string {
  const url = ORIGINAL_ASSET_URLS[`${ORIGINAL_IMAGE_ROOT}${path}`];
  if (url === undefined) throw new Error(`Missing original image: ${path}`);
  return url;
}

export function originalAssetPaths(prefix: string): readonly string[] {
  return Object.keys(ORIGINAL_ASSET_URLS)
    .map((key) => key.slice(ORIGINAL_IMAGE_ROOT.length))
    .filter((path) => path.startsWith(prefix))
    .sort(
      (left, right) =>
        Number(left.split("/").at(-1)?.split(".")[0]) -
        Number(right.split("/").at(-1)?.split(".")[0]),
    );
}

export const ORIGINAL_VISUAL_ASSET_PACK: VisualAssetPack = Object.freeze({
  treatment: ORIGINAL_ASSET_TREATMENT,
  image(path: string): VisualImageSource {
    return Object.freeze({ url: originalImageUrl(path), pixelDensity: 1 });
  },
});
