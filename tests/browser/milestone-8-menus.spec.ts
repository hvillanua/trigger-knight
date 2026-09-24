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

test("keeps settings in the same readable menu frame as achievements", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "View achievements" }).click();

  const achievementsFrame = await page
    .locator("#collections-screen")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const back = element.querySelector<HTMLElement>("#collections-back");
      if (back === null) {
        throw new Error("Missing Achievements back control");
      }
      const backRect = back.getBoundingClientRect();
      const backStyle = getComputedStyle(back);
      return {
        width: rect.width,
        height: rect.height,
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        color: style.color,
        back: {
          x: backRect.x - rect.x,
          y: backRect.y - rect.y,
          width: backRect.width,
          height: backRect.height,
          fontFamily: backStyle.fontFamily,
          fontSize: backStyle.fontSize,
          color: backStyle.color,
          backgroundColor: backStyle.backgroundColor,
          border: backStyle.borderTopWidth,
          borderRadius: backStyle.borderRadius,
        },
      };
    });

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const settingsFrame = await page
    .locator("#settings-screen")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const helpText = element.querySelector<HTMLElement>(".help-text");
      const bindingLabel =
        element.querySelector<HTMLElement>(".binding-row label");
      const back = element.querySelector<HTMLElement>("#settings-back");
      const heading = element.querySelector<HTMLElement>("#settings-heading");
      const headingRow = element.querySelector<HTMLElement>(
        ".screen-heading-row",
      );
      if (
        helpText === null ||
        bindingLabel === null ||
        back === null ||
        heading === null ||
        headingRow === null
      ) {
        throw new Error("Missing Settings text roles");
      }
      const backRect = back.getBoundingClientRect();
      const backStyle = getComputedStyle(back);
      const headingStyle = getComputedStyle(heading);
      const headingRowStyle = getComputedStyle(headingRow);
      return {
        width: rect.width,
        height: rect.height,
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        color: style.color,
        helpTextColor: getComputedStyle(helpText).color,
        bindingLabelColor: getComputedStyle(bindingLabel).color,
        back: {
          x: backRect.x - rect.x,
          y: backRect.y - rect.y,
          width: backRect.width,
          height: backRect.height,
          fontFamily: backStyle.fontFamily,
          fontSize: backStyle.fontSize,
          color: backStyle.color,
          backgroundColor: backStyle.backgroundColor,
          border: backStyle.borderTopWidth,
          borderRadius: backStyle.borderRadius,
        },
        heading: {
          text: heading.textContent,
          fontFamily: headingStyle.fontFamily,
          fontSize: headingStyle.fontSize,
          color: headingStyle.color,
        },
        headingRow: {
          backgroundColor: headingRowStyle.backgroundColor,
          boxShadow: headingRowStyle.boxShadow,
        },
      };
    });

  expect(settingsFrame.width).toBeCloseTo(achievementsFrame.width, 0);
  expect(settingsFrame.height).toBeCloseTo(achievementsFrame.height, 0);
  expect(settingsFrame.backgroundImage).toBe(achievementsFrame.backgroundImage);
  expect(settingsFrame.backgroundColor).toBe(achievementsFrame.backgroundColor);
  expect(settingsFrame.color).toBe(achievementsFrame.color);
  expect(settingsFrame.helpTextColor).toBe(achievementsFrame.color);
  expect(settingsFrame.bindingLabelColor).toBe(achievementsFrame.color);
  expect(settingsFrame.back).toEqual(achievementsFrame.back);
  expect(settingsFrame.heading).toMatchObject({
    text: "Settings",
    fontFamily: '"Trigger Knight Calibri", sans-serif',
    fontSize: "30px",
    color: "rgb(0, 0, 0)",
  });
  expect(settingsFrame.headingRow).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    boxShadow: "none",
  });
});

test("starts a run from the title and presents readable tutorial and pause states", async ({
  page,
}) => {
  await page.goto("/?manual=1");

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
    schemaVersion: 2,
    bindings: {
      togglePause: "KeyQ",
      dismissTutorial: "Space",
      purchaseCurrentEncounter: "KeyB",
      useCarriedItem: "KeyI",
    },
    sound: { muted: true, volume: 0.35 },
    visualAssets: "original",
  });

  await page.reload();
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

test("persists the visual asset choice and reports reload state", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.locator("#visual-assets").selectOption("high-res");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#settings-status")).toHaveText(
    "Settings saved. Reload the page to apply visual assets.",
  );
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        return raw === null
          ? null
          : (JSON.parse(raw) as { visualAssets?: string });
      }, SETTINGS_STORAGE_KEY),
    )
    .toMatchObject({ visualAssets: "high-res" });

  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#visual-assets")).toHaveValue("high-res");
  const visualStatus = await page
    .locator("#game-status")
    .getAttribute("data-visual-assets-status");
  expect(["high-res", "fallback"]).toContain(visualStatus);
  if (visualStatus === "fallback") {
    await expect(page.locator("#settings-status")).toContainText(
      "High-resolution assets are unavailable. Using Original.",
    );
  } else {
    await expect(page.locator("#settings-status")).toHaveText(
      "Settings loaded.",
    );
  }
});

test("does not request generated assets for an Original startup", async ({
  page,
}) => {
  const generatedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/generated/")) {
      generatedRequests.push(request.url());
    }
  });

  await page.goto("/?manual=1");
  await expect.poll(() => generatedRequests).toEqual([]);
});
