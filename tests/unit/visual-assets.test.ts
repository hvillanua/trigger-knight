import { describe, expect, it } from "vitest";

import {
  createSwinirVisualAssetPack,
  ORIGINAL_VISUAL_ASSET_PACK,
  resolveVisualAssetPack,
} from "../../src/browser/visual-assets.js";

function manifest(paths: readonly string[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    treatment: "swinir-2x",
    status: "generated",
    pixelDensity: 2,
    outputs: {
      root: "assets/generated/swinir-2x",
      files: paths.map((path) => ({ path, pixelDensity: 2 })),
    },
  });
}

describe("runtime visual asset packs", () => {
  it("keeps Original independent of the optional pack module", async () => {
    const pack = await resolveVisualAssetPack("original");

    expect(pack).toBe(ORIGINAL_VISUAL_ASSET_PACK);
    expect(pack.selection).toEqual({ kind: "original" });
    expect(pack.image("images/12.png").url).toContain("/assets/original/");
  });

  it("falls back to Original when the selected pack is missing", () => {
    const pack = createSwinirVisualAssetPack({
      imageUrls: {},
      manifestText: undefined,
    });

    expect(pack.selection).toEqual({ kind: "fallback", reason: "missing" });
    expect(pack.image("images/12.png").pixelDensity).toBe(1);
  });

  it("rejects malformed selected metadata", () => {
    const pack = createSwinirVisualAssetPack({
      imageUrls: {
        "../assets/generated/swinir-2x/images/12.png": "/swinir/12.png",
      },
      manifestText: manifest(["images/12.png", "../outside.png"]),
    });

    expect(pack.selection).toEqual({ kind: "fallback", reason: "invalid" });
  });

  it("uses generated sources only for manifest-approved paths", () => {
    const pack = createSwinirVisualAssetPack({
      imageUrls: {
        "../assets/generated/swinir-2x/images/12.png": "/swinir/12.png",
      },
      manifestText: manifest(["images/12.png"]),
    });

    expect(pack.selection).toEqual({ kind: "swinir-2x" });
    expect(pack.image("images/12.png")).toEqual({
      url: "/swinir/12.png",
      pixelDensity: 2,
    });
    expect(pack.image("images/529.jpg").url).toContain("/assets/original/");
    expect(pack.image("images/529.jpg").pixelDensity).toBe(1);
  });
});
