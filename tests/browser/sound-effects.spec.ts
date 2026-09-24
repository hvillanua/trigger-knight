import { expect, test } from "@playwright/test";

test("initializes sound from interaction and reports cue delivery", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(page.locator("#title-screen")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.triggerKnightSoundDiagnostics?.read().status),
    )
    .toMatch(/^(ready|degraded|suspended|unavailable|failed)$/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const diagnostics = window.triggerKnightSoundDiagnostics?.read();
        return (
          diagnostics?.playedCues.includes("button-press") === true ||
          diagnostics?.status === "suspended" ||
          diagnostics?.status === "unavailable" ||
          diagnostics?.status === "failed"
        );
      }),
    )
    .toBe(true);

  const diagnostics = await page.evaluate(() => {
    const value = window.triggerKnightSoundDiagnostics?.read();
    if (value === undefined) {
      throw new Error("Sound diagnostics are unavailable in development mode");
    }
    return value;
  });
  expect(diagnostics.deliveredCues).toContain("button-press");
  if (diagnostics.status === "ready" || diagnostics.status === "degraded") {
    expect(diagnostics.playedCues).toContain("button-press");
  }

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#sound-status")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect(page.locator("#sound-status")).not.toHaveText(
    "Sound effects start after the first player interaction.",
  );
});
