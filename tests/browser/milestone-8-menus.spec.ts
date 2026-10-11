import { expect, test } from "@playwright/test";

import {
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
} from "../../src/persistence/browser-profile-store.js";
import { SETTINGS_STORAGE_KEY } from "../../src/persistence/browser-settings-store.js";
import { createFreshProfile } from "../../src/domain/profile.js";

test("shares one illustrated page composition across menu pages", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const contract = await page.evaluate(() => {
    const pageIds = [
      "title-screen",
      "collections-screen",
      "credits-screen",
      "settings-screen",
    ];
    return pageIds.map((id) => {
      const screen = document.querySelector<HTMLElement>(`#${id}`);
      if (screen === null) throw new Error(`Missing ${id}`);
      const style = getComputedStyle(screen);
      const before = getComputedStyle(screen, "::before");
      const after = getComputedStyle(screen, "::after");
      const ratioParts = style.aspectRatio.split("/").map(Number);
      const ratioNumerator = ratioParts[0];
      if (ratioNumerator === undefined) {
        throw new Error(`Missing aspect ratio for ${id}`);
      }
      const ratioDenominator = ratioParts[1] ?? 1;
      const back = screen.querySelector<HTMLElement>('button[id$="-back"]');
      return {
        id,
        illustratedPage: screen.classList.contains("illustrated-page"),
        backgroundImage: style.backgroundImage,
        aspectRatio: ratioNumerator / ratioDenominator,
        containerType: style.containerType,
        isolation: style.isolation,
        before: {
          backgroundImage: before.backgroundImage,
          maskImage: before.maskImage,
          maskPositions: before.maskPosition
            .split(",")
            .map((position) => position.trim()),
          pointerEvents: before.pointerEvents,
          animationName: before.animationName,
          zIndex: before.zIndex,
        },
        after: {
          backgroundImage: after.backgroundImage,
          backgroundSize: after.backgroundSize,
          characterWidth: style
            .getPropertyValue("--illustrated-character-width")
            .trim(),
          characterSize: style
            .getPropertyValue("--illustrated-character-size")
            .trim(),
          pointerEvents: after.pointerEvents,
          zIndex: after.zIndex,
        },
        back:
          back === null
            ? null
            : {
                position: getComputedStyle(back).position,
                top: getComputedStyle(back).top,
                right: getComputedStyle(back).right,
                left: getComputedStyle(back).left,
              },
      };
    });
  });

  for (const pageContract of contract) {
    expect(pageContract.illustratedPage, pageContract.id).toBe(true);
    expect(pageContract.backgroundImage, pageContract.id).toContain("529.jpg");
    expect(pageContract.aspectRatio, pageContract.id).toBeCloseTo(1.5);
    expect(pageContract.containerType, pageContract.id).toBe("inline-size");
    expect(pageContract.isolation, pageContract.id).toBe("isolate");
    expect(pageContract.before.backgroundImage, pageContract.id).toContain(
      "357.jpg",
    );
    expect(pageContract.before.maskImage, pageContract.id).toContain("350.svg");
    expect(
      pageContract.before.maskImage.match(/350\.svg/g) ?? [],
      pageContract.id,
    ).toHaveLength(2);
    expect(pageContract.before.maskPositions, pageContract.id).toHaveLength(2);
    expect(pageContract.before.maskPositions[0], pageContract.id).toBe(
      "0px 0px",
    );
    expect(pageContract.before.maskPositions[1], pageContract.id).not.toBe(
      "0px 0px",
    );
    expect(pageContract.before.pointerEvents, pageContract.id).toBe("none");
    expect(pageContract.before.animationName, pageContract.id).toBe(
      "menu-sky-drift",
    );
    expect(pageContract.before.zIndex, pageContract.id).toBe("0");
    expect(pageContract.after.backgroundImage, pageContract.id).toContain(
      "533.png",
    );
    expect(pageContract.after.pointerEvents, pageContract.id).toBe("none");
    expect(pageContract.after.zIndex, pageContract.id).toBe("1");
    if (pageContract.back !== null) {
      expect(pageContract.back.position, pageContract.id).toBe("absolute");
      expect(pageContract.back.top, pageContract.id).not.toBe("auto");
      expect(pageContract.back.right, pageContract.id).not.toBe("auto");
      expect(pageContract.back.left, pageContract.id).toBe("auto");
    }
  }

  expect(contract[3]?.after.characterWidth).toBe(
    contract[0]?.after.characterWidth,
  );
  expect(contract[3]?.after.characterSize).toBe(
    contract[0]?.after.characterSize,
  );
});

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
      const settingsContent =
        element.querySelector<HTMLElement>(".settings-content");
      if (
        helpText === null ||
        bindingLabel === null ||
        back === null ||
        heading === null ||
        headingRow === null ||
        settingsContent === null
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
        settingsContentBackground:
          getComputedStyle(settingsContent).backgroundColor,
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
  expect(settingsFrame.settingsContentBackground).toBe("rgba(0, 0, 0, 0)");
  expect(settingsFrame.back).toMatchObject({
    width: achievementsFrame.back.width,
    height: achievementsFrame.back.height,
    fontFamily: achievementsFrame.back.fontFamily,
    fontSize: achievementsFrame.back.fontSize,
    color: achievementsFrame.back.color,
    backgroundColor: achievementsFrame.back.backgroundColor,
    border: achievementsFrame.back.border,
    borderRadius: achievementsFrame.back.borderRadius,
  });
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

  const settingsGeometry = await page
    .locator("#settings-screen")
    .evaluate((screen) => {
      const screenRect = screen.getBoundingClientRect();
      const elementFor = (selector: string): HTMLElement => {
        const element = screen.querySelector<HTMLElement>(selector);
        if (element === null) throw new Error(`Missing ${selector}`);
        return element;
      };
      const rectFor = (selector: string): DOMRect => {
        return elementFor(selector).getBoundingClientRect();
      };
      const content = elementFor(".settings-content");
      const contentRect = content.getBoundingClientRect();
      const characterWidth = Number.parseFloat(
        getComputedStyle(screen, "::after").width,
      );
      const fieldsets = [...screen.querySelectorAll("fieldset")].map(
        (element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        },
      );
      const actionsRect = rectFor("#settings-form > .controls");
      return {
        rightHalf: screenRect.left + screenRect.width / 2,
        contentLeft: contentRect.left,
        characterRight: screenRect.left + characterWidth,
        headingLeft: rectFor("#settings-heading").left,
        statusLeft: rectFor("#settings-status").left,
        promptLeft: rectFor("#settings-binding-prompt").left,
        formLeft: rectFor("#settings-form").left,
        contentRight: contentRect.right,
        fieldsets,
        actions: { left: actionsRect.left, right: actionsRect.right },
        scrollWidth: content.scrollWidth,
        clientWidth: content.clientWidth,
      };
    });
  expect(settingsGeometry.headingLeft).toBeGreaterThanOrEqual(
    settingsGeometry.contentLeft,
  );
  expect(settingsGeometry.statusLeft).toBeGreaterThanOrEqual(
    settingsGeometry.contentLeft,
  );
  expect(settingsGeometry.promptLeft).toBeGreaterThanOrEqual(
    settingsGeometry.contentLeft,
  );
  expect(settingsGeometry.formLeft).toBeGreaterThanOrEqual(
    settingsGeometry.contentLeft,
  );
  expect(settingsGeometry.contentLeft).toBeGreaterThan(
    settingsGeometry.rightHalf,
  );
  expect(settingsGeometry.characterRight).toBeGreaterThan(
    settingsGeometry.contentLeft,
  );
  expect(
    settingsGeometry.fieldsets.every(
      (fieldset) =>
        fieldset.left >= settingsGeometry.contentLeft &&
        fieldset.right <= settingsGeometry.contentRight,
    ),
  ).toBe(true);
  expect(settingsGeometry.actions.left).toBeGreaterThanOrEqual(
    settingsGeometry.contentLeft,
  );
  expect(settingsGeometry.actions.right).toBeLessThanOrEqual(
    settingsGeometry.contentRight,
  );
  expect(settingsGeometry.scrollWidth).toBeLessThanOrEqual(
    settingsGeometry.clientWidth,
  );
});

test("keeps the settings rail keyboard reachable in a short narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const rail = page.locator(".settings-content");
  const overflow = await rail.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

  const controls = page.locator(
    "#settings-back, #settings-form input, #settings-form select, #settings-form button",
  );
  await expect(controls).toHaveCount(14);
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
  }
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
  await expect(page.getByRole("heading", { name: "SURVIVE!" })).toBeVisible();
  await expect(page.locator("#tutorial-copy")).toContainText(
    "Lifespan or HP reaches 0",
  );
  await expect(page.locator("#tutorial-copy")).toContainText(
    "your Lifespan decreases gradually",
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
