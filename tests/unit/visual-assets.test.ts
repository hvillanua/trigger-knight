import { describe, expect, it } from "vitest";

import {
  createHighResolutionVisualAssetPack,
  ORIGINAL_VISUAL_ASSET_PACK,
  resolveVisualAssetPack,
} from "../../src/browser/visual-assets.js";

function manifest(paths: readonly string[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    treatment: "realesrgan-4x",
    status: "generated",
    filtering: "filtered",
    pixelDensity: 4,
    outputs: {
      root: "assets/generated/realesrgan-4x",
      files: paths.map((path) => ({ path, pixelDensity: 4 })),
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

  it("loads any generated treatment into the fixed high-resolution slot", async () => {
    const requestedUrls: URL[] = [];
    const pack = await resolveVisualAssetPack("high-res", {
      fetch: (input) => {
        const requestedUrl =
          typeof input === "string"
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL(input.url);
        requestedUrls.push(requestedUrl);
        return Promise.resolve(
          new Response(manifest(["images/12.png"]), { status: 200 }),
        );
      },
      baseUrl: new URL("https://example.test/game/"),
    });

    expect(requestedUrls).toEqual([
      new URL(
        "https://example.test/game/assets/generated/high-res/manifest.json",
      ),
    ]);
    expect(pack.selection).toEqual({ kind: "high-res" });
    expect(pack.image("images/12.png")).toEqual({
      url: "https://example.test/game/assets/generated/high-res/images/12.png",
      pixelDensity: 4,
    });
  });

  it("preserves original-density images in partial high-resolution treatments", () => {
    const pack = createHighResolutionVisualAssetPack({
      imageUrls: {
        "../assets/generated/high-res/key-sprites/hero/1.png":
          "/high-res/hero-1.png",
        "../assets/generated/high-res/images/350.svg": "/high-res/350.svg",
      },
      manifestText: JSON.stringify({
        schemaVersion: 1,
        treatment: "ffdec-2x",
        status: "generated",
        filtering: "nearest",
        pixelDensity: 2,
        outputs: {
          root: "assets/generated/ffdec-2x",
          files: [
            { path: "key-sprites/hero/1.png", pixelDensity: 2 },
            { path: "images/350.svg", pixelDensity: 1 },
            { path: "provenance.json" },
          ],
        },
      }),
    });

    expect(pack.selection).toEqual({ kind: "high-res" });
    expect(pack.image("key-sprites/hero/1.png").pixelDensity).toBe(2);
    expect(pack.image("images/350.svg").pixelDensity).toBe(1);
  });

  it("falls back to Original when the runtime manifest is absent", async () => {
    const pack = await resolveVisualAssetPack("high-res", {
      fetch: () => Promise.resolve(new Response(null, { status: 404 })),
      baseUrl: new URL("https://example.test/game/"),
    });

    expect(pack.selection).toEqual({ kind: "fallback", reason: "missing" });
    expect(pack.image("images/12.png").pixelDensity).toBe(1);
  });

  it("falls back to Original when the selected pack is missing", () => {
    const pack = createHighResolutionVisualAssetPack({
      imageUrls: {},
      manifestText: undefined,
    });

    expect(pack.selection).toEqual({ kind: "fallback", reason: "missing" });
    expect(pack.image("images/12.png").pixelDensity).toBe(1);
  });

  it("rejects malformed selected metadata", () => {
    const pack = createHighResolutionVisualAssetPack({
      imageUrls: {
        "../assets/generated/high-res/images/12.png": "/high-res/12.png",
      },
      manifestText: manifest(["images/12.png", "../outside.png"]),
    });

    expect(pack.selection).toEqual({ kind: "fallback", reason: "invalid" });
  });

  it("uses generated sources only for manifest-approved paths", () => {
    const pack = createHighResolutionVisualAssetPack({
      imageUrls: {
        "../assets/generated/high-res/images/12.png": "/high-res/12.png",
      },
      manifestText: manifest(["images/12.png"]),
    });

    expect(pack.selection).toEqual({ kind: "high-res" });
    expect(pack.image("images/12.png")).toEqual({
      url: "/high-res/12.png",
      pixelDensity: 4,
    });
    expect(pack.image("images/529.jpg").url).toContain("/assets/original/");
    expect(pack.image("images/529.jpg").pixelDensity).toBe(1);
  });
});
