import { describe, expect, it } from "vitest";

import { parseAssetTreatment } from "../../src/browser/asset-treatment.js";
import { applyVisualStyleTreatment } from "../../src/browser/asset-style.js";

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

    applyVisualStyleTreatment(parseAssetTreatment("realesrgan-4x"), root);

    expect(properties.get("--trigger-knight-parchment-image")).toContain(
      "/assets/generated/realesrgan-4x/",
    );
    expect(properties.get("--trigger-knight-title-hero-image")).toContain(
      "/assets/generated/realesrgan-4x/",
    );
    expect(properties.get("--trigger-knight-sky-image")).toContain(
      "/assets/generated/realesrgan-4x/",
    );
    expect(properties.get("--trigger-knight-cursor-image")).toContain(
      "/assets/original/images/12.png",
    );
  });
});
