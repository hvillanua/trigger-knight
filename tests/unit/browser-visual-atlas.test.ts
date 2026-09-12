import { describe, expect, it } from "vitest";

import {
  createVisualAtlas,
  ORIGINAL_SCENE_ASSET_URLS,
  ORIGINAL_SPRITE_URLS,
  VISUAL_SPRITES,
  WORLD_ATLAS_URL,
} from "../../src/browser/visual-atlas.js";

describe("approved visual atlas", () => {
  it("covers every player-facing actor, shop, item, and scenery family", () => {
    expect(Object.keys(VISUAL_SPRITES).sort()).toEqual([
      "armor",
      "armorsmith",
      "bladesmith",
      "cloud",
      "divine-edge",
      "dragon",
      "effect",
      "elixir",
      "fence",
      "goblin",
      "gold-voucher",
      "golem",
      "grims-shop",
      "hero",
      "moon",
      "mountain",
      "pharmacy",
      "pine",
      "road-marker",
      "rock",
      "sign",
      "soul-shrine",
      "spark",
      "tree",
      "voucher-store",
      "weapon",
      "wolf",
    ]);
    for (const sprite of Object.values(VISUAL_SPRITES)) {
      expect(typeof sprite.x).toBe("number");
      expect(typeof sprite.y).toBe("number");
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(96);
    }
  });

  it("records a fallback state when the optional browser image API is absent", () => {
    const atlas = createVisualAtlas(() => undefined);

    expect(WORLD_ATLAS_URL).toContain("world-atlas.svg");
    expect(atlas.status).toBe("fallback");
    expect(atlas.image).toBeUndefined();
  });

  it("maps the original character and scene exports into runtime assets", () => {
    expect(Object.keys(ORIGINAL_SPRITE_URLS).sort()).toEqual([
      "dragon",
      "goblin",
      "golem",
      "hero",
      "wolf",
    ]);
    expect(Object.keys(ORIGINAL_SCENE_ASSET_URLS).sort()).toEqual([
      "building",
      "ground",
      "mountains",
      "sky",
    ]);
    for (const url of Object.values(ORIGINAL_SPRITE_URLS)) {
      expect(url).toContain("/assets/original/key-sprites/");
    }
    for (const url of Object.values(ORIGINAL_SCENE_ASSET_URLS)) {
      expect(url).toContain("/assets/original/images/");
    }
  });
});
