import { describe, expect, it } from "vitest";

import { applyVisualStyleTreatment } from "../../src/browser/asset-style.js";
import { createHighResolutionVisualAssetPack } from "../../src/browser/visual-assets.js";

const pack = createHighResolutionVisualAssetPack({
  imageUrls: {
    "../assets/generated/high-res/images/529.jpg": "/high-res/529.jpg",
    "../assets/generated/high-res/images/533.png": "/high-res/533.png",
    "../assets/generated/high-res/images/357.jpg": "/high-res/357.jpg",
    "../assets/generated/high-res/shapes/350.svg": "/high-res/350.svg",
    "../assets/generated/high-res/images/268.png": "/high-res/268.png",
    "../assets/generated/high-res/images/12.png": "/high-res/12.png",
  },
  manifestText: JSON.stringify({
    schemaVersion: 1,
    treatment: "swinir-2x",
    status: "generated",
    filtering: "filtered",
    pixelDensity: 2,
    outputs: {
      root: "assets/generated/swinir-2x",
      files: [
        "images/529.jpg",
        "images/533.png",
        "images/357.jpg",
        "shapes/350.svg",
        "images/268.png",
        "images/12.png",
      ].map((path) => ({ path, pixelDensity: 2 })),
    },
  }),
});

describe("CSS-owned visual treatment", () => {
  it("uses generated screen art while retaining a logical-size cursor", () => {
    const properties = new Map<string, string>();
    const root = {
      style: {
        setProperty(name: string, value: string): void {
          properties.set(name, value);
        },
      },
    } as unknown as HTMLElement;

    applyVisualStyleTreatment(pack, root);

    expect(properties.get("--trigger-knight-parchment-image")).toContain(
      "/high-res/",
    );
    expect(properties.get("--trigger-knight-title-hero-image")).toContain(
      "/high-res/",
    );
    expect(properties.get("--trigger-knight-sky-image")).toContain(
      "/high-res/",
    );
    expect(properties.get("--trigger-knight-hand-cursor")).toContain(
      "/assets/original/images/12.png",
    );
    expect(properties.get("--trigger-knight-result-cursor")).toMatch(/, none$/);
  });
});
