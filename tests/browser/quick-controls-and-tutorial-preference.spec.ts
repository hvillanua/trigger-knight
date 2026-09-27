import { expect, test, type Page } from "@playwright/test";

interface SoundDiagnostics {
  readonly status: string;
  readonly musicPlaying: boolean;
  readonly soundEffectsMuted: boolean;
  readonly playedCues: readonly string[];
}

async function readSoundDiagnostics(page: Page): Promise<SoundDiagnostics> {
  const diagnostics = await page.evaluate(() => {
    const value = window.triggerKnightSoundDiagnostics?.read();
    if (value === undefined) {
      throw new Error("Sound diagnostics are unavailable in development mode");
    }
    return value;
  });
  return diagnostics;
}

async function collectTutorialPages(
  page: Page,
  maxSteps = 2_200,
): Promise<readonly string[]> {
  return page.evaluate((limit) => {
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    const dismiss = document.querySelector<HTMLButtonElement>(
      "#dismiss-tutorial",
    );
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    if (stage === null || dismiss === null || advance === null) {
      throw new Error("Missing manual tutorial controls");
    }

    const pages: string[] = [];
    for (let step = 0; step < limit && !advance.disabled; step += 1) {
      const page = stage.dataset.tutorialPage;
      if (page !== undefined) {
        if (pages.at(-1) !== page) pages.push(page);
        if (!dismiss.disabled) dismiss.click();
      }
      advance.click();
    }
    return pages;
  }, maxSteps);
}

test("toggles gameplay music with the M quick control", async ({ page }) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

  await expect
    .poll(async () => (await readSoundDiagnostics(page)).status)
    .toMatch(/^(ready|degraded)$/);
  await expect
    .poll(async () => (await readSoundDiagnostics(page)).musicPlaying)
    .toBe(true);

  await page.keyboard.press("m");
  await expect
    .poll(async () => (await readSoundDiagnostics(page)).musicPlaying)
    .toBe(false);

  await page.keyboard.press("m");
  await expect
    .poll(async () => (await readSoundDiagnostics(page)).musicPlaying)
    .toBe(true);
});

test("toggles sound effects with the S quick control", async ({ page }) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await expect
    .poll(async () => (await readSoundDiagnostics(page)).status)
    .toMatch(/^(ready|degraded)$/);

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await expect(page.locator("#toggle-pause")).toBeVisible();
  const beforeMute = await readSoundDiagnostics(page);

  await page.keyboard.press("s");
  await expect
    .poll(async () => (await readSoundDiagnostics(page)).soundEffectsMuted)
    .toBe(true);
  expect((await readSoundDiagnostics(page)).playedCues.length).toBe(
    beforeMute.playedCues.length,
  );
  await page.keyboard.press("p");
});

test("uses the enabled tutorial preference for contextual pages", async ({
  page,
}) => {
  await page.goto("/?manual=1&seed=tutorial-gates-browser-parity");
  await page.getByRole("button", { name: "Start run" }).click();

  const pages = await collectTutorialPages(page);

  expect(pages).toEqual(expect.arrayContaining(["0", "1", "3", "4", "5"]));
});

test("keeps the initial tutorial while disabling contextual pages", async ({
  page,
}) => {
  await page.goto("/?manual=1&seed=tutorial-gates-browser-parity");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("#tutorial-preference").uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#settings-status")).toHaveText(
    "Settings saved.",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Start run" }).click();

  const pages = await collectTutorialPages(page);

  expect(pages).toEqual(["0"]);
});

test("preserves the enabled tutorial preference after a completed run", async ({
  page,
}) => {
  await page.goto("/?manual=1&seed=tutorial-preference-persistence");
  await page.getByRole("button", { name: "Start run" }).click();

  await collectTutorialPages(page, 2_600);
  await page.locator("#game-canvas").click();
  await expect(page.locator("#run-result")).toHaveAttribute(
    "data-result-state",
    "committed",
  );

  await expect(page.locator("#title-tutorial-toggle")).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("trigger-knight.profile");
        if (raw === null) return null;
        const envelope = JSON.parse(raw) as {
          settings?: { tutorialPreference?: string };
        };
        return envelope.settings?.tutorialPreference ?? null;
      }),
    )
    .toBe("enabled");
});
