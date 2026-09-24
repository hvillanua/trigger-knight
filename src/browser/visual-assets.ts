import type { VisualAssetPreference } from "../application/settings.js";
import {
  assetTreatmentForPreference,
  type AssetTreatment,
} from "./asset-treatment.js";
export type PixelDensity = 1 | 2 | 4;

export interface VisualImageSource {
  readonly url: string;
  readonly pixelDensity: PixelDensity;
}

export type VisualPackSelection =
  | Readonly<{ kind: "original" }>
  | Readonly<{ kind: "swinir-2x" }>
  | Readonly<{
      kind: "fallback";
      reason: "missing" | "invalid" | "load-failed";
    }>;

export interface VisualAssetPack {
  readonly selection: VisualPackSelection;
  readonly treatment: AssetTreatment;
  image(originalPath: string): VisualImageSource;
}

export interface VisualAssetCatalog {
  readonly imageUrls: Readonly<Record<string, string>>;
  readonly manifestText: string | undefined;
}

const ORIGINAL_IMAGE_ROOT = "../assets/original/";
const GENERATED_IMAGE_ROOT = "../assets/generated/";

const ORIGINAL_IMAGE_URLS = Object.freeze({
  ...import.meta.glob<string>("../assets/original/**/*.png", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.jpg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.jpeg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.svg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
});

function originalImageUrl(path: string): string {
  const url = ORIGINAL_IMAGE_URLS[`${ORIGINAL_IMAGE_ROOT}${path}`];
  if (url === undefined) throw new Error(`Missing original image: ${path}`);
  return url;
}

export function originalAssetPaths(prefix: string): readonly string[] {
  return Object.keys(ORIGINAL_IMAGE_URLS)
    .map((key) => key.slice(ORIGINAL_IMAGE_ROOT.length))
    .filter((path) => path.startsWith(prefix))
    .sort(
      (left, right) =>
        Number(left.split("/").at(-1)?.split(".")[0]) -
        Number(right.split("/").at(-1)?.split(".")[0]),
    );
}

function originalImageSource(path: string): VisualImageSource {
  return Object.freeze({ url: originalImageUrl(path), pixelDensity: 1 });
}

export const ORIGINAL_VISUAL_ASSET_PACK: VisualAssetPack = Object.freeze({
  selection: Object.freeze({ kind: "original" }),
  treatment: assetTreatmentForPreference("original"),
  image: originalImageSource,
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeAssetPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isImagePath(path: string): boolean {
  return /\.(?:png|jpe?g|svg)$/i.test(path);
}

function parseSwinirManifest(raw: string): ReadonlyMap<string, PixelDensity> {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("Manifest is not a record");
  if (
    value.schemaVersion !== 1 ||
    value.treatment !== "swinir-2x" ||
    value.status !== "generated" ||
    value.pixelDensity !== 2
  ) {
    throw new Error("Manifest does not describe the SwinIR 2x pack");
  }
  const outputs = value.outputs;
  if (!isRecord(outputs) || outputs.root !== "assets/generated/swinir-2x") {
    throw new Error("Manifest output root is invalid");
  }
  const files = outputs.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Manifest output files are invalid");
  }

  const densities = new Map<string, PixelDensity>();
  for (const file of files) {
    if (
      !isRecord(file) ||
      typeof file.path !== "string" ||
      !isSafeAssetPath(file.path) ||
      !isImagePath(file.path) ||
      file.pixelDensity !== 2 ||
      densities.has(file.path)
    ) {
      throw new Error("Manifest contains an invalid output file");
    }
    densities.set(file.path, 2);
  }
  return densities;
}

function catalogImagePath(key: string): string {
  const prefix = `${GENERATED_IMAGE_ROOT}swinir-2x/`;
  if (!key.startsWith(prefix)) {
    throw new Error(`Catalog contains an unexpected image path: ${key}`);
  }
  return key.slice(prefix.length);
}

function packFromCatalog(catalog: VisualAssetCatalog): VisualAssetPack {
  if (
    catalog.manifestText === undefined ||
    Object.keys(catalog.imageUrls).length === 0
  ) {
    throw new Error("SwinIR 2x pack is missing");
  }
  const densities = parseSwinirManifest(catalog.manifestText);
  const generatedSources = new Map<string, VisualImageSource>();
  for (const [key, url] of Object.entries(catalog.imageUrls)) {
    const path = catalogImagePath(key);
    if (!densities.has(path) || typeof url !== "string" || url === "") {
      throw new Error("Catalog and manifest do not match");
    }
    const density = densities.get(path);
    if (density === undefined) throw new Error("Catalog density is missing");
    generatedSources.set(path, Object.freeze({ url, pixelDensity: density }));
  }
  if (generatedSources.size !== densities.size) {
    throw new Error("Manifest contains images missing from the catalog");
  }

  return Object.freeze({
    selection: Object.freeze({ kind: "swinir-2x" }),
    treatment: assetTreatmentForPreference("swinir-2x"),
    image(path: string): VisualImageSource {
      return generatedSources.get(path) ?? originalImageSource(path);
    },
  });
}

function fallbackPack(
  reason: Extract<VisualPackSelection, { kind: "fallback" }>["reason"],
): VisualAssetPack {
  return Object.freeze({
    selection: Object.freeze({ kind: "fallback", reason }),
    treatment: ORIGINAL_VISUAL_ASSET_PACK.treatment,
    image: originalImageSource,
  });
}

export function createSwinirVisualAssetPack(
  catalog: VisualAssetCatalog,
): VisualAssetPack {
  try {
    return packFromCatalog(catalog);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SwinIR 2x pack is missing"
    ) {
      return fallbackPack("missing");
    }
    return fallbackPack("invalid");
  }
}

export async function resolveVisualAssetPack(
  preference: VisualAssetPreference,
): Promise<VisualAssetPack> {
  if (preference === "original") return ORIGINAL_VISUAL_ASSET_PACK;
  try {
    const module = await import("./swinir-2x-assets.js");
    return createSwinirVisualAssetPack(module.SWINIR_2X_ASSET_CATALOG);
  } catch {
    return fallbackPack("load-failed");
  }
}
