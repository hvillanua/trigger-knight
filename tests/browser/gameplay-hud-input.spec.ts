import { expect, test } from "@playwright/test";

test("shows readable public HUD values and keeps queued battles generic", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  await expect(page.locator("#hud-hero-hp")).toHaveText("1,908/1,908");
  await expect(page.locator("#hud-lifespan")).toHaveText("99.99%");
  await expect(page.locator("#hud-gold")).toHaveText("300");
  await expect(page.locator("#hud-weapon")).toHaveText("Dagger · ATK 216");
  await expect(page.locator("#hud-armor")).toHaveText("Clothing");
  await expect(page.locator("#hud-item")).toHaveText("Elixir");
  await expect(page.locator("#hud-score")).toHaveText("0");
  await expect(page.locator("#hud-day")).toHaveText("1");
  await expect(page.locator("#hud-upcoming-encounters li")).toHaveCount(3);
  await expect(page.locator("#hud-upcoming-encounters")).toContainText(
    "Battle",
  );
  await expect(page.locator("#hud-upcoming-encounters")).not.toContainText(
    /goblin|golem|wolf|dragon/i,
  );
});

test("routes keyboard bindings once and ignores held-key repeats", async ({
  page,
}) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();

  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-observation-step",
    "1",
  );
  await expect(page.locator("#tutorial-panel")).toBeHidden();

  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const trace = await page.evaluate(() =>
    window.triggerKnightDiagnostics?.read(),
  );
  expect(trace?.checkpoints).toHaveLength(3);
  expect(trace?.checkpoints.at(-1)?.commands).toEqual([
    { type: "toggle-pause" },
  ]);
});

test("hides pause and main-menu controls during an active run", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    const pause = document.querySelector<HTMLElement>("#toggle-pause");
    const quit = document.querySelector<HTMLElement>("#gameplay-main-menu");
    if (stage === null || canvas === null || pause === null || quit === null) {
      throw new Error("Missing gameplay controls");
    }
    const stageBox = stage.getBoundingClientRect();
    const pauseBox = pause.getBoundingClientRect();
    const quitBox = quit.getBoundingClientRect();
    const hudHit = document.elementFromPoint(
      stageBox.right - stageBox.width * 0.04,
      stageBox.bottom - stageBox.height * 0.04,
    );
    return {
      pauseVisible: getComputedStyle(pause).display !== "none",
      quitVisible: getComputedStyle(quit).display !== "none",
      pauseArea: pauseBox.width * pauseBox.height,
      quitArea: quitBox.width * quitBox.height,
      hudHitId: hudHit instanceof HTMLElement ? hudHit.id : null,
      canvasId: canvas.id,
    };
  });

  expect(geometry.pauseVisible).toBe(false);
  expect(geometry.quitVisible).toBe(false);
  expect(geometry.pauseArea).toBe(0);
  expect(geometry.quitArea).toBe(0);
  expect(geometry.hudHitId).toBe(geometry.canvasId);
});

test("hides the physical cursor over the gameplay canvas", async ({ page }) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await page.locator("#game-canvas").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await expect(page.locator("#game-canvas")).toHaveCSS("cursor", "none");
});

test("uses the original hand cursor on the title and tutorial screens", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();

  const cursorsWhileTutorial = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (stage === null || canvas === null)
      throw new Error("Missing gameplay stage");
    return {
      stage: getComputedStyle(stage).cursor,
      canvas: getComputedStyle(canvas).cursor,
    };
  });
  expect(cursorsWhileTutorial.stage).toContain("/12.png");
  expect(cursorsWhileTutorial.canvas).toContain("/12.png");

  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(page.locator("#title-screen")).toBeVisible();

  const titleCursors = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>("#title-screen");
    const start = document.querySelector<HTMLButtonElement>("#start-run");
    if (title === null || start === null)
      throw new Error("Missing title screen");
    return {
      title: getComputedStyle(title).cursor,
      start: getComputedStyle(start).cursor,
    };
  });
  expect(titleCursors.title).toContain("/12.png");
  expect(titleCursors.start).toContain("/12.png");
});

test("keeps the original hand cursor visible over pause controls", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await page.locator("#game-canvas").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });
  const activeCursors = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (canvas === null) {
      throw new Error("Missing active gameplay controls");
    }
    return {
      canvas: getComputedStyle(canvas).cursor,
    };
  });
  expect(activeCursors.canvas).toBe("none");

  await page.keyboard.press("p");
  const pausedCursors = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".gameplay-stage");
    const resume = document.querySelector<HTMLButtonElement>("#toggle-pause");
    if (stage === null || resume === null) {
      throw new Error("Missing paused gameplay controls");
    }
    return {
      stage: getComputedStyle(stage).cursor,
      resume: getComputedStyle(resume).cursor,
    };
  });
  expect(pausedCursors.stage).toContain("/12.png");
  expect(pausedCursors.resume).toContain("/12.png");
});

test("dismisses the first tutorial dialog from any stage click", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.locator("#tutorial-panel")).toBeVisible();

  await page.locator(".gameplay-stage").dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    pointerType: "mouse",
  });

  await expect(page.locator("#tutorial-panel")).toBeHidden();
});

test("keeps the keyboard pause shortcut active while controls are hidden", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();

  await page.keyboard.press("p");
  await expect(page.locator("#pause-panel")).toBeHidden();
  await expect(page.locator("#toggle-pause")).toBeHidden();
});

test("prevents held Enter from repeating a focused gameplay button", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  await page.keyboard.press("p");
  const resumeButton = page.getByRole("button", {
    name: "Resume",
    exact: true,
  });
  await resumeButton.focus();
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");

  await expect(page.locator("#pause-panel")).toBeHidden();
});

test("captures, cancels, and rejects conflicting keyboard remaps", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.locator('[data-remap-action="togglePause"]').click();
  await page.keyboard.press("q");
  await expect(page.locator("#binding-toggle-pause")).toHaveValue("KeyQ");
  await expect(page.locator("#settings-binding-prompt")).toContainText(
    "Pause is Q",
  );

  for (const key of ["m", "s", "f"]) {
    await page.locator('[data-remap-action="togglePause"]').click();
    await page.keyboard.press(key);
    await expect(page.locator("#binding-toggle-pause")).toHaveValue("KeyQ");
    await expect(page.locator("#settings-binding-prompt")).toContainText(
      "reserved for a global shortcut",
    );
    await page.keyboard.press("Escape");
  }

  await page.locator('[data-remap-action="purchaseCurrentEncounter"]').click();
  await page.keyboard.press("q");
  await expect(page.locator("#binding-purchase")).toHaveValue("KeyB");
  await expect(page.locator("#settings-binding-prompt")).toContainText(
    "already assigned to Pause",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-binding-prompt")).toContainText(
    "remapping cancelled",
  );

  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator("#settings-status")).toHaveText("Settings saved.");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#binding-toggle-pause")).toHaveValue("KeyQ");
});

test("purchases the current shop from any Canvas click", async ({ page }) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  const found = await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const purchase = document.querySelector<HTMLButtonElement>(
      "#purchase-current-encounter",
    );
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    if (advance === null || purchase === null || dismiss === null)
      throw new Error("Missing controls");
    for (let index = 0; index < 4_000 && purchase.disabled; index += 1) {
      if (!dismiss.disabled) dismiss.click();
      advance.click();
    }
    return !purchase.disabled;
  });
  expect(found).toBe(true);

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (canvas === null) throw new Error("Missing game canvas");
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: 1,
        clientY: 1,
        pointerId: 7,
        pointerType: "touch",
      }),
    );
  });

  await expect(page.locator("#game-feedback")).toContainText("Purchased");
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-purchase-eligible",
    "false",
  );
});

test("uses the Canvas item prompt for one touch-style battle activation", async ({
  page,
}) => {
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();

  const found = await page.evaluate(() => {
    const advance = document.querySelector<HTMLButtonElement>("#advance-run");
    const dismiss =
      document.querySelector<HTMLButtonElement>("#dismiss-tutorial");
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (advance === null || dismiss === null || canvas === null) {
      throw new Error("Missing controls");
    }
    for (let index = 0; index < 4_000; index += 1) {
      if (!dismiss.disabled) dismiss.click();
      if (canvas.dataset.itemEligible === "true") return true;
      advance.click();
    }
    return false;
  });
  expect(found).toBe(true);

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (canvas === null) throw new Error("Missing game canvas");
    const rect = canvas.getBoundingClientRect();
    const camera = canvas.dataset.worldCamera?.split(",").map(Number);
    const projection = canvas.dataset.projectionViewport
      ?.split(",")
      .map(Number);
    if (camera === undefined || projection === undefined) {
      throw new Error("Missing public Canvas projection");
    }
    const scale = projection[2]! / camera[2]!;
    const backingX = projection[0]! + (110 - camera[0]!) * scale;
    const backingY = projection[1]! + (176 - camera[1]!) * scale;
    const styles = getComputedStyle(canvas);
    const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const clientX =
      rect.left + borderLeft + (backingX / canvas.width) * canvas.clientWidth;
    const clientY =
      rect.top + borderTop + (backingY / canvas.height) * canvas.clientHeight;
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX,
        clientY,
        pointerId: 8,
        pointerType: "touch",
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX,
        clientY,
        pointerId: 8,
        pointerType: "touch",
      }),
    );
  });

  await expect(page.locator("#game-feedback")).toContainText("Used Elixir");
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-item-eligible",
    "false",
  );
});
