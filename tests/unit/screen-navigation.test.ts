import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createScreenNavigation,
  type ScreenNavigationElements,
} from "../../src/browser/screen-navigation.js";

class FakeElement {
  hidden = false;
  textContent: string | null = "";
  title = "";
  type = "";
  className = "";
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = { width: "" };
  readonly focus = vi.fn();
  readonly addEventListener = vi.fn();
  readonly setAttribute = vi.fn();

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }
}

function element<
  K extends keyof HTMLElementTagNameMap,
>(): HTMLElementTagNameMap[K] {
  return new FakeElement() as unknown as HTMLElementTagNameMap[K];
}

function setup() {
  vi.stubGlobal("document", {
    createElement: () => new FakeElement(),
    createTextNode: () => new FakeElement(),
  });
  const screens = {
    title: element<"section">(),
    gameplay: element<"section">(),
    result: element<"section">(),
    collections: element<"section">(),
    settings: element<"section">(),
  };
  const elements = {
    screens,
    profileSummary: element<"p">(),
    titleProfileSummary: element<"p">(),
    weaponCollection: element<"ul">(),
    armorCollection: element<"ul">(),
    collectionProgress: element<"p">(),
    playerStatusLevel: element<"p">(),
    playerStatusXp: element<"p">(),
    playerStatusXpFill: element<"span">(),
    equipmentPreview: element<"div">(),
    playerStatusChallenges: element<"ul">(),
    playerStatusProgress: element<"p">(),
  } satisfies ScreenNavigationElements;
  const onLeaveGameplay = vi.fn();
  const profile = Object.freeze({
    schemaVersion: 2,
    scoreMultiplier: 1,
    tutorialPreference: "enabled" as const,
    weaponDiscoveries: Array.from({ length: 10 }, () => false),
    armorDiscoveries: Array.from({ length: 10 }, () => false),
    achievementSlots: Array.from({ length: 6 }, () => false),
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
  return { elements, navigation, onLeaveGameplay };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("screen navigation", () => {
  it("does not stop result presentation effects when browsing another screen", () => {
    const { navigation, onLeaveGameplay } = setup();

    navigation.show("result");
    navigation.show("collections");
    navigation.show("settings");

    expect(onLeaveGameplay).toHaveBeenCalledTimes(1);
  });

  it("renders the canonical player status screen", () => {
    const { elements, navigation } = setup();

    navigation.show("title");
    navigation.showProfileScreen();

    expect(navigation.current()).toBe("collections");
    expect(elements.screens.collections.hidden).toBe(false);
    expect(elements.playerStatusLevel.textContent).toBe("Level 1 (x1 Score)");
    expect(elements.playerStatusXp.textContent).toBe("0/130 EXP");
    expect(elements.playerStatusXpFill.style.width).toBe("0%");
    expect(elements.playerStatusChallenges.children).toHaveLength(5);
    expect(elements.playerStatusProgress.textContent).toBe(
      "Game Progress - 0%",
    );
  });
});
