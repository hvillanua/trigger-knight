import { expect, test } from "@playwright/test";

test("loads the browser and Canvas foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Trigger Knight" }),
  ).toBeVisible();
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

test("sizes the Canvas backing store from its content box after a DPR change", async ({
  context,
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-renderer", "canvas-2d");

  const initial = await canvas.evaluate(async (element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("Expected a Canvas element");
    }

    const contentBox = await new Promise<DOMRectReadOnly>((resolve) => {
      const observer = new ResizeObserver(([entry]) => {
        if (entry === undefined) {
          return;
        }

        observer.disconnect();
        resolve(entry.contentRect);
      });
      observer.observe(element);
    });
    const borderBox = element.getBoundingClientRect();

    return {
      contentWidth: contentBox.width,
      contentHeight: contentBox.height,
      borderWidth: borderBox.width,
      borderHeight: borderBox.height,
      devicePixelRatio: window.devicePixelRatio,
    };
  });
  expect(initial.borderWidth).toBeGreaterThan(initial.contentWidth);
  expect(initial.borderHeight).toBeGreaterThan(initial.contentHeight);

  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("The browser test requires a fixed viewport");
  }

  const changedDevicePixelRatio = initial.devicePixelRatio === 2 ? 1 : 2;
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
          backingWidth: element.width,
          backingHeight: element.height,
          devicePixelRatio: window.devicePixelRatio,
        };
      }),
    )
    .toEqual({
      backingWidth: Math.round(initial.contentWidth * changedDevicePixelRatio),
      backingHeight: Math.round(
        initial.contentHeight * changedDevicePixelRatio,
      ),
      devicePixelRatio: changedDevicePixelRatio,
    });
});
