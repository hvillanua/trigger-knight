import ORIGINAL_ASSET_URLS from "virtual:trigger-knight/original-assets";

import type { VisualAssetPreference } from "../application/settings.js";
import {
  assetTreatmentForHighResolution,
  assetTreatmentForPreference,
  HIGH_RESOLUTION_ASSET_DIRECTORY,
  type AssetTreatment,
  type ImageFiltering,
} from "./asset-treatment.js";
export type PixelDensity = 1 | 2 | 4;

export interface VisualImageSource {
  readonly url: string;
  readonly pixelDensity: PixelDensity;
}

export type VisualPackSelection =
  | Readonly<{ kind: "original" }>
  | Readonly<{ kind: "high-res" }>
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

export interface VisualAssetPackDependencies {
  readonly fetch: typeof fetch;
  readonly baseUrl: URL;
}

const ORIGINAL_IMAGE_ROOT = "../assets/original/";
const GENERATED_IMAGE_ROOT = "../assets/generated/";
const HIGH_RESOLUTION_IMAGE_ROOT = `${GENERATED_IMAGE_ROOT}${HIGH_RESOLUTION_ASSET_DIRECTORY}/`;
const ORIGINAL_IMAGE_URLS = ORIGINAL_ASSET_URLS;

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

interface ParsedHighResolutionManifest {
  readonly densities: ReadonlyMap<string, PixelDensity>;
  readonly filtering: ImageFiltering;
}

function isHighResolutionDensity(
  value: unknown,
): value is Exclude<PixelDensity, 1> {
  return value === 2 || value === 4;
}

function isPixelDensity(value: unknown): value is PixelDensity {
  return value === 1 || value === 2 || value === 4;
}

function manifestFiltering(value: unknown): ImageFiltering {
  if (value === undefined || value === "linear" || value === "filtered") {
    return "linear";
  }
  if (value === "nearest") return "nearest";
  throw new Error("Manifest filtering mode is invalid");
}

function parseHighResolutionManifest(
  raw: string,
): ParsedHighResolutionManifest {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("Manifest is not a record");
  if (
    value.schemaVersion !== 1 ||
    typeof value.treatment !== "string" ||
    value.treatment.length === 0 ||
    value.status !== "generated" ||
    !isHighResolutionDensity(value.pixelDensity)
  ) {
    throw new Error("Manifest does not describe a high-resolution pack");
  }
  const outputs = value.outputs;
  if (
    !isRecord(outputs) ||
    typeof outputs.root !== "string" ||
    !isSafeAssetPath(outputs.root)
  ) {
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
      densities.has(file.path)
    ) {
      throw new Error("Manifest contains an invalid output file");
    }
    if (isImagePath(file.path)) {
      if (
        !isPixelDensity(file.pixelDensity) ||
        (file.pixelDensity !== 1 && file.pixelDensity !== value.pixelDensity)
      ) {
        throw new Error("Manifest contains an invalid output file");
      }
      densities.set(file.path, file.pixelDensity);
    }
  }
  if (densities.size === 0) {
    throw new Error("Manifest contains no runtime images");
  }
  return Object.freeze({
    densities,
    filtering: manifestFiltering(value.filtering),
  });
}

function catalogImagePath(key: string): string {
  if (!key.startsWith(HIGH_RESOLUTION_IMAGE_ROOT)) {
    throw new Error(`Catalog contains an unexpected image path: ${key}`);
  }
  return key.slice(HIGH_RESOLUTION_IMAGE_ROOT.length);
}

function packFromCatalog(catalog: VisualAssetCatalog): VisualAssetPack {
  if (
    catalog.manifestText === undefined ||
    Object.keys(catalog.imageUrls).length === 0
  ) {
    throw new Error("High-resolution pack is missing");
  }
  const manifest = parseHighResolutionManifest(catalog.manifestText);
  const generatedSources = new Map<string, VisualImageSource>();
  for (const [key, url] of Object.entries(catalog.imageUrls)) {
    const path = catalogImagePath(key);
    if (
      !manifest.densities.has(path) ||
      typeof url !== "string" ||
      url === ""
    ) {
      throw new Error("Catalog and manifest do not match");
    }
    const density = manifest.densities.get(path);
    if (density === undefined) throw new Error("Catalog density is missing");
    generatedSources.set(path, Object.freeze({ url, pixelDensity: density }));
  }
  if (generatedSources.size !== manifest.densities.size) {
    throw new Error("Manifest contains images missing from the catalog");
  }

  return Object.freeze({
    selection: Object.freeze({ kind: "high-res" }),
    treatment: assetTreatmentForHighResolution(manifest.filtering),
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

export function createHighResolutionVisualAssetPack(
  catalog: VisualAssetCatalog,
): VisualAssetPack {
  try {
    return packFromCatalog(catalog);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "High-resolution pack is missing"
    ) {
      return fallbackPack("missing");
    }
    return fallbackPack("invalid");
  }
}

export async function resolveVisualAssetPack(
  preference: VisualAssetPreference,
  dependencies?: VisualAssetPackDependencies,
): Promise<VisualAssetPack> {
  if (preference === "original") return ORIGINAL_VISUAL_ASSET_PACK;

  const runtime =
    dependencies ??
    Object.freeze({
      fetch: globalThis.fetch.bind(globalThis),
      baseUrl: new URL(import.meta.env.BASE_URL, window.location.href),
    });
  const packRoot = new URL(
    `assets/generated/${HIGH_RESOLUTION_ASSET_DIRECTORY}/`,
    runtime.baseUrl,
  );
  try {
    const response = await runtime.fetch(new URL("manifest.json", packRoot));
    if (response.status === 404) return fallbackPack("missing");
    if (!response.ok) return fallbackPack("load-failed");
    const manifestText = await response.text();
    const manifest = parseHighResolutionManifest(manifestText);
    const imageUrls = Object.fromEntries(
      [...manifest.densities.keys()].map((path) => [
        `${HIGH_RESOLUTION_IMAGE_ROOT}${path}`,
        new URL(path, packRoot).href,
      ]),
    );
    return createHighResolutionVisualAssetPack({ imageUrls, manifestText });
  } catch {
    return fallbackPack("load-failed");
  }
}
