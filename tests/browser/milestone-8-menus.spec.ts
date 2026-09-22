import { expect, test } from "@playwright/test";

import {
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
} from "../../src/persistence/browser-profile-store.js";
import { SETTINGS_STORAGE_KEY } from "../../src/persistence/browser-settings-store.js";
import { createFreshProfile } from "../../src/domain/profile.js";

test("browses collections and defined achievements from the main menu", async ({
  page,
}) => {
  const profile = {
    ...createFreshProfile(),
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
  };
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: PROFILE_STORAGE_KEY,
      value: {
        schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
        profile: {
          schemaVersion: profile.schemaVersion,
          level: profile.level,
          xp: profile.xp,
          scoreMultiplier: profile.scoreMultiplier,
          highScore: profile.highScore,
          weaponDiscoveries: profile.weaponDiscoveries,
          armorDiscoveries: profile.armorDiscoveries,
          achievementSlots: profile.achievementSlots,
        },
        settings: { tutorialPreference: profile.tutorialPreference },
        completedRuns: [],
      },
    },
  );
  await page.goto("/?manual=1");

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(page.locator("#title-screen")).toBeVisible();
  await expect(page.locator("#gameplay-screen")).toBeHidden();
  await expect(page.locator("#result-collections")).toHaveCount(1);
  await expect(page.locator("#result-achievements")).toHaveCount(1);
  await expect(page.locator("#title-profile-summary")).toContainText(
    "Collections 3/20",
  );
  await expect(page.locator("#title-collections")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View collections" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "View achievements" }).click();
  await expect(page.locator("#collections-screen")).toBeVisible();
  await expect(page.locator("#weapon-collection li")).toHaveCount(10);
  await expect(page.locator("#armor-collection li")).toHaveCount(10);
  await expect(
    page.locator('#weapon-collection li[data-discovered="true"]'),
  ).toHaveCount(2);
  await expect(page.locator("#weapon-collection")).toContainText(
    "Tier 2: Sword",
  );
  await expect(page.locator("#player-status-challenges li")).toHaveCount(5);
  await expect(
    page.locator('#player-status-challenges li[data-unlocked="true"]'),
  ).toHaveCount(1);
  await expect(page.locator("#player-status-challenges")).toContainText(
    "Slay a Dragon",
  );
  await expect(page.locator("#player-status-challenges")).not.toContainText(
    "undefined",
  );
});

test("starts a run from the title and presents readable tutorial and pause states", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.locator("#gameplay-screen")).toBeVisible();
  await expect(page.locator("#gameplay-screen")).toBeFocused();
  await expect(page.locator("#tutorial-panel")).toBeVisible();
  await expect(page.locator("#tutorial-page-label")).toHaveText(
    "Tutorial page 1 of 6",
  );
  await expect(
    page.getByRole("heading", { name: "Basic survival" }),
  ).toBeVisible();
  await expect(page.locator("#tutorial-copy")).toContainText(
    "lifespan or HP becomes 0",
  );
  await expect(page.locator("#tutorial-copy")).toContainText(
    "Lifespan reduces gradually",
  );

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await expect(page.locator("#pause-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator("#pause-panel")).toBeHidden();
});

test("persists settings independently and reloads them through the menu", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.locator("#tutorial-preference").uncheck();
  await page.locator("#sound-muted").check();
  await page.locator("#sound-volume").fill("0.35");
  await page.locator("#binding-toggle-pause").fill("KeyQ");
  await page.locator("#binding-dismiss-tutorial").fill("Space");
  await page.locator("#binding-purchase").fill("KeyB");
  await page.locator("#binding-use-item").fill("KeyI");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#settings-status")).toHaveText("Settings saved.");

  const settings = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      throw new Error("Expected settings to be stored");
    }
    return JSON.parse(raw) as unknown;
  }, SETTINGS_STORAGE_KEY);
  expect(settings).toEqual({
    schemaVersion: 1,
    bindings: {
      togglePause: "KeyQ",
      dismissTutorial: "Space",
      purchaseCurrentEncounter: "KeyB",
      useCarriedItem: "KeyI",
    },
    sound: { muted: true, volume: 0.35 },
  });

  await page.reload();
  await page.keyboard.press("q");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#tutorial-preference")).not.toBeChecked();
  await expect(page.locator("#sound-muted")).toBeChecked();
  await expect(page.locator("#sound-volume")).toHaveValue("0.35");
  await expect(page.locator("#binding-toggle-pause")).toHaveValue("KeyQ");

  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect(page.locator("#sound-volume")).toHaveValue("1");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#sound-volume")).toHaveValue("0.35");
});
