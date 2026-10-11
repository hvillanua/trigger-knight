import { describe, expect, it } from "vitest";

import { applyVisualStyleTreatment } from "../../src/browser/asset-style.js";
import { ORIGINAL_VISUAL_ASSET_PACK } from "../../src/browser/visual-assets.js";

describe("CSS-owned visual treatment", () => {
  it("uses artwork from the replaceable original asset directory", () => {
    const properties = new Map<string, string>();
    const root = {
      style: {
        setProperty(name: string, value: string): void {
          properties.set(name, value);
        },
      },
    } as unknown as HTMLElement;

    applyVisualStyleTreatment(ORIGINAL_VISUAL_ASSET_PACK, root);

    expect(properties.get("--trigger-knight-parchment-image")).toContain(
      "/assets/original/",
    );
    expect(properties.get("--trigger-knight-title-hero-image")).toContain(
      "/assets/original/",
    );
    expect(properties.get("--trigger-knight-sky-image")).toContain(
      "/assets/original/",
    );
    expect(properties.get("--trigger-knight-hand-cursor")).toContain(
      "/assets/original/images/12.png",
    );
  });
});
