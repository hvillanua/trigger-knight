import { describe, expect, it, vi } from "vitest";

import {
  createScreenNavigation,
  type ScreenNavigationElements,
} from "../../src/browser/screen-navigation.js";

function element(): {
  hidden: boolean;
  focus: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
} {
  return {
    hidden: false,
    focus: vi.fn(),
    addEventListener: vi.fn(),
  };
}

function setup() {
  const screens = {
    title: element(),
    gameplay: element(),
    result: element(),
    collections: element(),
    achievements: element(),
    settings: element(),
  };
  const elements = {
    screens,
    profileSummary: element(),
    titleProfileSummary: element(),
    weaponCollection: element(),
    armorCollection: element(),
    collectionProgress: element(),
    playerStatusLevel: element(),
    playerStatusXp: element(),
    equipmentPreview: element(),
    playerStatusChallenges: element(),
    playerStatusProgress: element(),
    achievementList: element(),
    achievementProgress: element(),
  } as unknown as ScreenNavigationElements;
  const onLeaveGameplay = vi.fn();
  const profile = Object.freeze({
    schemaVersion: 2,
    scoreMultiplier: 1,
    tutorialPreference: "enabled" as const,
    weaponDiscoveries: [],
    armorDiscoveries: [],
    achievementSlots: [],
    level: 1,
    xp: 0,
    highScore: 0,
  });
  const navigation = createScreenNavigation(elements, {
    readProfile: () => profile,
    onLeaveGameplay,
    beforeShowTitle: vi.fn(),
    prepareSettings: vi.fn(),
    renderSettings: vi.fn(),
  });
  return { navigation, onLeaveGameplay };
}

describe("screen navigation", () => {
  it("does not stop result presentation effects when browsing another screen", () => {
    const { navigation, onLeaveGameplay } = setup();

    navigation.show("result");
    navigation.show("collections");
    navigation.show("settings");

    expect(onLeaveGameplay).toHaveBeenCalledTimes(1);
  });
});
