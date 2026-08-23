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
