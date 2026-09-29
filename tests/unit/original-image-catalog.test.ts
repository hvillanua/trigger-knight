import { describe, expect, it } from "vitest";

import { originalAssetCatalogSource } from "../../build/original-image-catalog.js";

describe("original asset catalog source", () => {
  it("generates sorted direct URLs with the deployment base and encoded segments", () => {
    expect(
      originalAssetCatalogSource(["images/z.png", "images/a #%.svg"], {
        command: "serve",
        base: "/knight/",
      }),
    ).toBe(
      'export default Object.freeze({"../assets/original/images/a #%.svg":"/knight/src/assets/original/images/a%20%23%25.svg","../assets/original/images/z.png":"/knight/src/assets/original/images/z.png"});',
    );
  });

  it("keeps production images as static Vite asset imports", () => {
    expect(
      originalAssetCatalogSource(["images/z.png", "images/a.png"], {
        command: "build",
        base: "/knight/",
      }),
    ).toBe(
      'import asset0 from "/src/assets/original/images/a.png?url&no-inline";\n' +
        'import asset1 from "/src/assets/original/images/z.png?url&no-inline";\n' +
        'export default Object.freeze({"../assets/original/images/a.png":asset0,"../assets/original/images/z.png":asset1});',
    );
  });

  it("versions development URLs when an asset changes", () => {
    expect(
      originalAssetCatalogSource(["images/a.png", "sounds/game.mp3"], {
        command: "serve",
        base: "/",
        versions: new Map([
          ["images/a.png", "123-456"],
          ["sounds/game.mp3", "789-1011"],
        ]),
      }),
    ).toBe(
      'export default Object.freeze({"../assets/original/images/a.png":"/src/assets/original/images/a.png?v=123-456","../assets/original/sounds/game.mp3":"/src/assets/original/sounds/game.mp3?v=789-1011"});',
    );
  });

  it.each([
    "../secret.png",
    "/image.png",
    "images/../image.png",
    "images\\image.png",
    "images//image.png",
    "images/./image.png",
    "images/provenance.json",
  ])("rejects invalid staged image path %s", (file) => {
    expect(() =>
      originalAssetCatalogSource([file], { command: "serve", base: "/" }),
    ).toThrow("Invalid original asset path");
  });
});
