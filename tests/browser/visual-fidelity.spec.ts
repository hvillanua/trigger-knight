import { expect, test } from "@playwright/test";

test("keeps the reference-backed screens composed and interactive", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();

  const titleAssets = await page.locator("#title-screen").evaluate(() => {
    const readBackground = (selector: string): string => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element === null) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element).backgroundImage;
    };
    return {
      parchment: readBackground("#title-screen"),
      sky: readBackground(".title-sky"),
      hero: readBackground(".title-hero-art"),
      logo: readBackground(".title-logo"),
    };
  });
  expect(titleAssets.parchment).toContain("529.jpg");
  expect(titleAssets.sky).toContain("357.jpg");
  expect(titleAssets.hero).toContain("533.png");
  expect(titleAssets.logo).toContain("268.png");
  const titleFooterAlignment = await page
    .locator(".title-footer-row")
    .evaluate((row) => {
      const tutorial = row.querySelector<HTMLElement>(".title-tutorial-toggle");
      const footer = row.querySelector<HTMLElement>(".title-footer");
      if (tutorial === null || footer === null) {
        throw new Error("Missing title footer controls");
      }
      const tutorialRect = tutorial.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        display: getComputedStyle(row).display,
        centerDelta: Math.abs(
          tutorialRect.top +
            tutorialRect.height / 2 -
            (footerRect.top + footerRect.height / 2),
        ),
      };
    });
  expect(titleFooterAlignment.display).toBe("flex");
  expect(titleFooterAlignment.centerDelta).toBeLessThan(1);
  await expect(page.locator(".title-footer")).toHaveText(
    "| M/S to mute Music/SFX, P to Pause",
  );
  await expect(page.locator(".title-footer > span")).toHaveCount(8);
  const footerGaps = await page.locator(".title-footer").evaluate((footer) => {
    const spans = [...footer.children].map((child) =>
      child.getBoundingClientRect(),
    );
    return spans.slice(1).map((span, index) => {
      const previous = spans[index];
      if (previous === undefined) throw new Error("Missing footer span");
      return span.left - previous.right;
    });
  });
  expect(footerGaps.every((gap) => gap >= 1)).toBe(true);
  const initialSkyPosition = await page
    .locator(".title-sky")
    .evaluate((element) => getComputedStyle(element).backgroundPositionX);
  await expect
    .poll(() =>
      page
        .locator(".title-sky")
        .evaluate((element) => getComputedStyle(element).backgroundPositionX),
    )
    .not.toBe(initialSkyPosition);
  const titleTutorialToggle = page.locator("#title-tutorial-toggle");
  await expect(titleTutorialToggle).toBeChecked();
  await titleTutorialToggle.uncheck();
  await expect(titleTutorialToggle).not.toBeChecked();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#tutorial-preference")).not.toBeChecked();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await titleTutorialToggle.check();
  await testInfo.attach("reference-title-screen.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "View collections" }).click();
  const profileAssets = await page
    .locator("#collections-screen")
    .evaluate(() => {
      const screen = document.querySelector<HTMLElement>("#collections-screen");
      const hero = document.querySelector<HTMLElement>(".player-status-hero");
      if (screen === null || hero === null)
        throw new Error("Missing player status art");
      return {
        parchment: getComputedStyle(screen).backgroundImage,
        hero: getComputedStyle(hero).backgroundImage,
      };
    });
  expect(profileAssets.parchment).toContain("529.jpg");
  expect(profileAssets.hero).toContain("533.png");
  const equipmentSlots = page.locator(".equipment-slot");
  await expect(equipmentSlots).toHaveCount(20);
  await expect(page.locator("#weapons-heading")).toHaveText("Wpns");
  await expect(page.locator("#armor-heading")).toHaveText("Armrs");
  const collectionGeometry = await page
    .locator("#collections-screen")
    .evaluate((screen) => {
      const screenRect = screen.getBoundingClientRect();
      const columns = screen.querySelector<HTMLElement>(".collection-columns");
      if (columns === null) throw new Error("Missing collection columns");
      return (
        (columns.getBoundingClientRect().left - screenRect.left) /
        screenRect.width
      );
    });
  expect(collectionGeometry).toBeGreaterThanOrEqual(0.62);
  await expect(page.locator(".player-status-hint")).toHaveCount(0);
  await equipmentSlots.first().focus();
  await expect(page.locator("#equipment-preview")).toHaveText("Lv1 - Dagger");
  await expect(page.locator("#equipment-preview")).toHaveCSS(
    "text-align",
    "right",
  );
  await expect(equipmentSlots.first()).toHaveAttribute("title", "Lv1 - Dagger");
  await equipmentSlots.nth(1).hover();
  await expect(page.locator("#equipment-preview")).toHaveText("Lv2 - Sword");
  await equipmentSlots.first().click();
  await expect(page.locator("#equipment-preview")).toHaveText("Lv1 - Dagger");
  const armorSlot = page.locator("#armor-collection .equipment-slot").last();
  await armorSlot.hover();
  await expect(page.locator("#equipment-preview")).toHaveText(
    "Lv10 - Astral Armor",
  );
  await expect(armorSlot).toHaveAttribute("title", "Lv10 - Astral Armor");
  await expect(page.locator("#player-status-xp")).toHaveText("0/130 EXP");
  await expect(page.locator("#player-status-progress")).toHaveText(
    "Game Progress - 7%",
  );
  await testInfo.attach("reference-player-status.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.locator("#tutorial-panel")).toBeVisible();
  await testInfo.attach("reference-tutorial.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  const canvas = page.locator("#game-canvas");
  await expect(canvas).toHaveAttribute(
    "data-asset-source",
    "original-runtime-assets",
  );
  await expect
    .poll(() => canvas.getAttribute("data-asset-status"))
    .toBe("ready");
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await testInfo.attach("reference-gameplay.png", {
    body: await canvas.screenshot(),
    contentType: "image/png",
  });

  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await testInfo.attach("reference-pause.png", {
    body: await canvas.screenshot(),
    contentType: "image/png",
  });
});

test("keeps the title actions inside the stage at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();

  const stage = page.locator("#title-screen");
  const stageBox = await stage.boundingBox();
  if (stageBox === null) throw new Error("Missing title stage bounds");
  for (const selector of [
    "#start-run",
    "#title-collections",
    "#title-achievements",
    "#title-settings",
  ]) {
    const button = page.locator(selector);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    if (box === null) throw new Error(`Missing bounds for ${selector}`);
    expect(box.y).toBeGreaterThanOrEqual(stageBox.y);
    expect(box.y + box.height).toBeLessThanOrEqual(
      stageBox.y + stageBox.height,
    );
    expect(box.x).toBeGreaterThanOrEqual(stageBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(stageBox.x + stageBox.width);
  }
});
