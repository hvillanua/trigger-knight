import { loadOriginalFonts } from "./font-assets.js";
import {
  ORIGINAL_ASSET_TREATMENT,
  type AssetTreatment,
} from "./asset-treatment.js";
import {
  createVisualAtlas,
  type VisualAtlas,
  type VisualAtlasStatus,
} from "./visual-atlas.js";

export type CanvasFontStatus = "loading" | "ready" | "fallback";

export type CanvasResourceChange =
  | Readonly<{ type: "assets"; status: VisualAtlasStatus }>
  | Readonly<{ type: "fonts"; status: CanvasFontStatus }>;

export interface CanvasResources {
  readonly atlas: VisualAtlas;
  readonly fontStatus: CanvasFontStatus;
}

/** Starts the browser presentation's image and font loads in one adapter owner. */
export function createCanvasResources(
  onChange: (change: CanvasResourceChange) => void,
  treatment: AssetTreatment = ORIGINAL_ASSET_TREATMENT,
): CanvasResources {
  let fontStatus: CanvasFontStatus = "loading";
  const atlas = createVisualAtlas((status) => {
    onChange({ type: "assets", status });
  }, treatment);

  void loadOriginalFonts().then((loaded) => {
    fontStatus = loaded ? "ready" : "fallback";
    onChange({ type: "fonts", status: fontStatus });
  });

  return Object.freeze({
    atlas,
    get fontStatus() {
      return fontStatus;
    },
  });
}
