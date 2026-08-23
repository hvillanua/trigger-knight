import { expect, test } from "@playwright/test";

test("loads the browser and Canvas foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Trigger Knight" }),
  ).toBeVisible();
  await expect(page.getByTestId("foundation-status")).toHaveText(
    "Project foundation ready",
  );

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-renderer", "canvas-2d");

  expect(
    await canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        return false;
      }

      return (
        element.width > 0 &&
        element.height > 0 &&
        element.getContext("2d") !== null
      );
    }),
  ).toBe(true);
});

test("updates the Canvas backing store when device pixel ratio changes", async ({
  context,
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-renderer", "canvas-2d");

  const initial = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();

    return {
      cssWidth: bounds.width,
      cssHeight: bounds.height,
      devicePixelRatio: window.devicePixelRatio,
    };
  });
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("The browser test requires a fixed viewport");
  }

  const changedDevicePixelRatio =
    initial.devicePixelRatio === 2 ? 1 : 2;
  const browserSession = await context.newCDPSession(page);
  await browserSession.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: changedDevicePixelRatio,
    mobile: false,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
          throw new Error("Expected a Canvas element");
        }

        return {
          cssWidth: element.getBoundingClientRect().width,
          cssHeight: element.getBoundingClientRect().height,
          backingWidth: element.width,
          backingHeight: element.height,
          devicePixelRatio: window.devicePixelRatio,
        };
      }),
    )
    .toEqual({
      cssWidth: initial.cssWidth,
      cssHeight: initial.cssHeight,
      backingWidth: Math.round(initial.cssWidth * changedDevicePixelRatio),
      backingHeight: Math.round(initial.cssHeight * changedDevicePixelRatio),
      devicePixelRatio: changedDevicePixelRatio,
    });
});
