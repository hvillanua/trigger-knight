import { expect, test } from "@playwright/test";

test("drives the shared engine through a semantic browser command", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByRole("img", { name: "Trigger Knight game view" });
  await expect(canvas).toHaveAttribute("data-observation-step", "0");

  await page.getByRole("button", { name: "Advance run" }).click();

  await expect(page.getByTestId("game-status")).toHaveText("Step 1");
  await expect(canvas).toHaveAttribute("data-observation-step", "1");
  await expect(canvas).toHaveAttribute("data-events", "step-advanced:1");
});

test("physical Canvas size does not change the engine result", async ({
  browser,
}) => {
  const results = await Promise.all(
    [
      { width: 480, height: 640 },
      { width: 1280, height: 720 },
    ].map(async (viewport) => {
      const page = await browser.newPage({ viewport });

      try {
        await page.goto("/");
        const canvas = page.getByRole("img", {
          name: "Trigger Knight game view",
        });
        await expect(canvas).toHaveAttribute("data-observation-step", "0");
        await page.getByRole("button", { name: "Advance run" }).click();

        return await canvas.evaluate((element) => {
          if (!(element instanceof HTMLCanvasElement)) {
            throw new Error("Expected a Canvas element");
          }

          return {
            backingSize: {
              width: element.width,
              height: element.height,
            },
            observationStep: element.dataset.observationStep,
            events: element.dataset.events,
          };
        });
      } finally {
        await page.close();
      }
    }),
  );

  expect(results[0]?.backingSize).not.toEqual(results[1]?.backingSize);
  expect(
    results.map(({ observationStep, events }) => ({
      observationStep,
      events,
    })),
  ).toEqual([
    { observationStep: "1", events: "step-advanced:1" },
    { observationStep: "1", events: "step-advanced:1" },
  ]);
});
