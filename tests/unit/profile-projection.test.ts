import { describe, expect, it } from "vitest";

import { createProfileOverviewView } from "../../src/application/profile.js";
import {
  createFreshProfile,
  normalizeProfile,
} from "../../src/domain/profile.js";

describe("player-visible profile projection", () => {
  it("selects individual discoveries and only the five defined achievements", () => {
    const profile = normalizeProfile({
      ...createFreshProfile(),
      level: 3,
      xp: 47,
      scoreMultiplier: 1.3,
      highScore: 900,
      weaponDiscoveries: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      achievementSlots: [true, false, false, false, false, true],
    });

    const view = createProfileOverviewView(profile);

    expect(view).toEqual({
      level: 3,
      xp: 47,
      scoreMultiplier: 1.3,
      highScore: 900,
      collections: {
        weapons: [
          { tier: 1, name: "Dagger", discovered: true },
          { tier: 2, name: "Sword", discovered: true },
          { tier: 3, name: "Rapier", discovered: false },
          { tier: 4, name: "Falchion", discovered: false },
          { tier: 5, name: "Katana", discovered: false },
          { tier: 6, name: "Flamberge", discovered: false },
          { tier: 7, name: "Zweihander", discovered: false },
          { tier: 8, name: "Broad Kris", discovered: false },
          { tier: 9, name: "Excalibur", discovered: false },
          { tier: 10, name: "Astral Sword", discovered: false },
        ],
        armor: [
          { tier: 1, name: "Clothing", discovered: true },
          { tier: 2, name: "Protector", discovered: false },
          { tier: 3, name: "Breastplate", discovered: false },
          { tier: 4, name: "Chainmail", discovered: false },
          { tier: 5, name: "Fullplate", discovered: false },
          { tier: 6, name: "Samurai Mail", discovered: false },
          { tier: 7, name: "Valkyrie Garb", discovered: false },
          { tier: 8, name: "Odin Garb", discovered: false },
          { tier: 9, name: "Avalon", discovered: false },
          { tier: 10, name: "Astral Armor", discovered: false },
        ],
        weaponCount: 2,
        armorCount: 1,
        totalDiscovered: 3,
        total: 20,
      },
      achievements: [
        { id: "slay-a-dragon", unlocked: true },
        { id: "stashed-3000-gold", unlocked: false },
        { id: "reach-day-10", unlocked: false },
        { id: "get-all-collection", unlocked: false },
        { id: "perform-70000-damage", unlocked: false },
      ],
      progress: {
        collectionPoints: 10.5,
        achievementPoints: 6,
        totalPoints: 16.5,
      },
    });

    expect(view).not.toHaveProperty("weaponDiscoveries");
    expect(view).not.toHaveProperty("achievementSlots");
    expect(view).not.toHaveProperty("tutorialPreference");
    expect(view.achievements).toHaveLength(5);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.collections.weapons)).toBe(true);
  });
});
