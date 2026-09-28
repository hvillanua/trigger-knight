import { expect, test } from "@playwright/test";

test("opens credits and returns to the title with focus restored", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  await expect(page.locator(".title-attribution")).toContainText(
    "Fan made modern-browser adaptation. Original game by Mintsphere.",
  );
  const creditsButton = page.getByRole("button", { name: "Credits" });
  await creditsButton.click();

  const credits = page.locator("#credits-screen");
  await expect(credits).toBeVisible();
  await expect(page.locator("#title-screen")).toBeHidden();
  const artworkBox = await credits.locator(".credits-artwork").boundingBox();
  if (artworkBox === null) throw new Error("Missing credits artwork bounds");
  expect(artworkBox.width).toBeCloseTo(480, 0);
  expect(artworkBox.height).toBeCloseTo(320, 0);
  await expect(credits).toHaveAttribute("aria-labelledby", "credits-heading");
  await expect(
    credits.getByRole("heading", { name: "Game Credits" }),
  ).toBeVisible();
  await expect(credits).toContainText("STUDIO MINTSPHERE");
  await expect(credits).toContainText("FanFan");
  await expect(credits).toContainText("Vresu");
  await expect(credits).toContainText("Rudy Sudarto");
  await expect(credits).toContainText("Various Free Sound Source");
  await expect(credits).toContainText("Lots of Beta Testers");
  await expect(credits).toContainText("and You!");
  await expect(credits).toContainText(
    "© 2011 MINTSPHERE. All rights reserved.",
  );
  await expect(credits).toContainText(
    "This browser version is a fan-made adaptation of Trigger Knight for modern browsers. It is not the original Flash release.",
  );
  const creditsAssets = await credits.evaluate(() => {
    const sky = document.querySelector<HTMLElement>(".credits-sky");
    const hero = document.querySelector<HTMLElement>(".credits-hero");
    if (sky === null || hero === null) throw new Error("Missing credits art");
    return {
      sky: getComputedStyle(sky).backgroundImage,
      hero: getComputedStyle(hero).backgroundImage,
      heroBackgroundColor: getComputedStyle(hero).backgroundColor,
      heroMask: getComputedStyle(hero).maskImage,
    };
  });
  expect(creditsAssets.sky).toContain("357.jpg");
  expect(creditsAssets.hero).toContain("533.png");
  expect(creditsAssets.heroBackgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(creditsAssets.heroMask).toContain("533.png");
  await expect(
    credits.locator(".credits-artwork .credits-adaptation"),
  ).toBeVisible();
  const layout = await credits
    .locator(".credits-artwork")
    .evaluate((artwork) => {
      const original = artwork.querySelector<HTMLElement>(
        ".credits-original-copy",
      );
      const adaptation = artwork.querySelector<HTMLElement>(
        ".credits-adaptation",
      );
      if (original === null || adaptation === null) {
        throw new Error("Missing credits copy layout");
      }
      return {
        artworkHeight: artwork.getBoundingClientRect().height,
        artworkScrollHeight: artwork.scrollHeight,
        originalBottom: original.getBoundingClientRect().bottom,
        adaptationTop: adaptation.getBoundingClientRect().top,
        adaptationBottom: adaptation.getBoundingClientRect().bottom,
        artworkBottom: artwork.getBoundingClientRect().bottom,
      };
    });
  expect(layout.artworkScrollHeight).toBeCloseTo(layout.artworkHeight, 0);
  expect(layout.originalBottom).toBeLessThan(layout.adaptationTop);
  expect(layout.adaptationBottom).toBeLessThanOrEqual(layout.artworkBottom);

  const facebook = credits.getByRole("link", {
    name: "Mintsphere on Facebook (opens in a new tab)",
  });
  await expect(facebook).toHaveAttribute(
    "href",
    "https://www.facebook.com/Mintsphere",
  );
  await expect(facebook).toHaveAttribute("target", "_blank");
  await expect(facebook).toHaveAttribute("rel", "noopener noreferrer");
  const facebookStyles = await facebook.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      decoration: style.textDecorationLine,
      shadow: style.textShadow,
    };
  });
  expect(facebookStyles.color).toBe("rgb(87, 200, 238)");
  expect(facebookStyles.decoration).toBe("underline");
  expect(facebookStyles.shadow).toBe("none");

  await credits.getByRole("button", { name: "Back" }).click();
  await expect(page.locator("#title-screen")).toBeVisible();
  await expect(credits).toBeHidden();
  await expect(creditsButton).toBeFocused();
});

test("keeps credits controls reachable in a short narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Credits" }).click();

  const credits = page.locator("#credits-screen");
  const overflow = await credits.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollHeight).toBeCloseTo(overflow.clientHeight, 0);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  const back = credits.getByRole("button", { name: "Back" });
  await back.scrollIntoViewIfNeeded();
  await expect(back).toBeInViewport();
  const facebook = credits.getByRole("link", {
    name: "Mintsphere on Facebook (opens in a new tab)",
  });
  await facebook.scrollIntoViewIfNeeded();
  await expect(facebook).toBeInViewport();
});

test("keeps the title attribution clear of menu and footer controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?manual=1");

  const geometry = await page.locator("#title-screen").evaluate((screen) => {
    const bounds = (selector: string): DOMRect => {
      const element = screen.querySelector<HTMLElement>(selector);
      if (element === null) throw new Error(`Missing ${selector}`);
      return element.getBoundingClientRect();
    };
    const attribution = bounds(".title-attribution");
    const footer = bounds(".title-footer-row");
    const actions = [
      "#start-run",
      "#title-achievements",
      "#title-credits",
      "#title-settings",
    ].map(bounds);
    return {
      attributionBottom: attribution.bottom,
      footerTop: footer.top,
      actionBottoms: actions.map(({ bottom }) => bottom),
      attributionTop: attribution.top,
    };
  });

  expect(geometry.attributionBottom).toBeLessThanOrEqual(geometry.footerTop);
  expect(
    geometry.actionBottoms.every((bottom) => bottom <= geometry.attributionTop),
  ).toBe(true);
});
