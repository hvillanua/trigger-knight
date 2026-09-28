import { expect, test, type Page } from "@playwright/test";

interface SoundDiagnostics {
  readonly status: string;
  readonly musicPlaying: boolean;
  readonly soundEffectsMuted: boolean;
  readonly playedCues: readonly string[];
}

interface TutorialSnapshot {
  readonly title: string;
  readonly copy: string;
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
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
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

async function collectTutorialContent(
  page: Page,
  maxSteps = 2_600,
): Promise<Readonly<Record<string, TutorialSnapshot>>> {
  return page.evaluate((limit) => {
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const heading = document.querySelector<HTMLElement>("#tutorial-heading");
    const copy = document.querySelector<HTMLElement>("#tutorial-copy");
    if (
      stage === null ||
      dismiss === null ||
      advance === null ||
      heading === null ||
      copy === null
    ) {
      throw new Error("Missing tutorial content controls");
    }

    const snapshots: Record<string, TutorialSnapshot> = {};
    for (let step = 0; step < limit && !advance.disabled; step += 1) {
      const tutorialPage = stage.dataset.tutorialPage;
      if (tutorialPage !== undefined) {
        snapshots[tutorialPage] = {
          title: heading.textContent ?? "",
          copy: copy.textContent ?? "",
        };
        if (!dismiss.disabled) dismiss.click();
      }
      advance.click();
    }
    return snapshots;
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

test("renders the recovered copy on every tutorial page", async ({ page }) => {
  await page.goto("/?manual=1&seed=m6-04-tutorial-preference");
  await page.getByRole("button", { name: "Start run" }).click();

  const content = await collectTutorialContent(page);

  expect(content).toEqual(
    expect.objectContaining({
      "0": {
        title: "SURVIVE!",
        copy: "Guide the Knight to survive as long as possible using only one click at a time! The game ends when your Lifespan or HP reaches 0, so be careful. Getting hit by the Enemy reduces your HP, while your Lifespan decreases gradually over time.",
      },
      "1": {
        title: "TRIGGER!",
        copy: "You are about to encounter an \"Event\". The cursor will change depending on the event, whether you are upgrading your weapon or armor (which also restores HP) or buying items. Click to trigger the event! Don't be late or you'll miss it. Triggering events requires some gold, though, so be careful! The interface shows upcoming events. Use it to plan ahead!",
      },
      "2": {
        title: "RESTORATION!",
        copy: "Ah! A Soul Shrine ahead! If you find a Soul Shrine along the way, you can spend some of your gold to fully restore your Lifespan. Just click when the cursor changes shape to trigger the event! It is the only way to restore your Lifespan and prolong your survival. Please save some gold for it!",
      },
      "3": {
        title: "BATTLE!",
        copy: "Battles in this game are automatic. The Knight will try to defeat the enemy on her own. Please cheer for her! However, if you have items in your inventory, you can use them by clicking the mouse button to turn the tide of battle (sometimes)! Defeating enemies grants you gold, which you can spend to trigger events, such as upgrading your weapon. Enemies get stronger over time, so you should too!",
      },
      "4": {
        title: "I'M FADING!",
        copy: "Uh-oh, the Blademaster's Lifespan is nearly depleted. She starts to fade! Solution: Restore it by triggering a Soul Shrine event. Don't worry, Soul Shrines are plentiful, so we will find one in a short time. Hopefully.",
      },
      "5": {
        title: "I'M WOUNDED!",
        copy: "Ouchie! The Blademaster is low on HP! If her HP reaches 0, she'll die! Help! Solution: Use an Elixir or upgrade your Armor. Getting slashed by a sword really hurts! Luckily, we have some spare Elixir, right? ...Right?",
      },
    }),
  );
});

test("keeps the initial tutorial while disabling contextual pages", async ({
  page,
}) => {
  await page.goto("/?manual=1&seed=tutorial-gates-browser-parity");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("#tutorial-preference").uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#settings-status")).toHaveText("Settings saved.");
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
