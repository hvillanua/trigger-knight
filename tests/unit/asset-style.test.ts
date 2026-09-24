import { describe, expect, it } from "vitest";

import { applyVisualStyleTreatment } from "../../src/browser/asset-style.js";
import { createSwinirVisualAssetPack } from "../../src/browser/visual-assets.js";

const pack = createSwinirVisualAssetPack({
  imageUrls: {
    "../assets/generated/swinir-2x/images/529.jpg": "/swinir/529.jpg",
    "../assets/generated/swinir-2x/images/533.png": "/swinir/533.png",
    "../assets/generated/swinir-2x/images/357.jpg": "/swinir/357.jpg",
    "../assets/generated/swinir-2x/shapes/350.svg": "/swinir/350.svg",
    "../assets/generated/swinir-2x/images/268.png": "/swinir/268.png",
    "../assets/generated/swinir-2x/images/12.png": "/swinir/12.png",
  },
  manifestText: JSON.stringify({
    schemaVersion: 1,
    treatment: "swinir-2x",
    status: "generated",
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
      "/swinir/",
    );
    expect(properties.get("--trigger-knight-title-hero-image")).toContain(
      "/swinir/",
    );
    expect(properties.get("--trigger-knight-sky-image")).toContain("/swinir/");
    expect(properties.get("--trigger-knight-hand-cursor")).toContain(
      "/assets/original/images/12.png",
    );
    expect(properties.get("--trigger-knight-result-cursor")).toMatch(/, none$/);
  });
});
