import { describe, expect, it } from "vitest";

import {
  createVisualAtlas,
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
});
