import { expect, test } from "@playwright/test";
import type * as CanvasModule from "../../src/browser/canvas-presentation.js";

test("draws original animation poses and preserves positions through battle transitions", async ({
  page,
}, testInfo) => {
  await page.goto("/?manual=1&diagnostics=1");
  await page.getByRole("button", { name: "Start run" }).click();
  const result = await page.evaluate(async (modulePath) => {
    const { CanvasPresentation } = (await import(
      modulePath
    )) as typeof CanvasModule;
    const base =
      window.triggerKnightDiagnostics?.read().checkpoints[0]?.observation;
    if (!base) throw new Error("Missing initial observation");
    const canvas = document.createElement("canvas");
    canvas.id = "animation-test";
    canvas.width = 480;
    canvas.height = 320;
    document.body.append(canvas);
    const presentation = new CanvasPresentation(canvas);
    while (canvas.dataset.assetStatus === "loading")
      await new Promise((resolve) => setTimeout(resolve, 10));
    await document.fonts.ready;
    const calls: Array<{
      src: string;
      x: number;
      y: number;
      scale: number;
      args: number[];
    }> = [];
    const drawImage = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    )!.value as CanvasRenderingContext2D["drawImage"];
    CanvasRenderingContext2D.prototype.drawImage = function (
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (
        image instanceof HTMLImageElement &&
        image.src.includes("key-sprites")
      ) {
        const transform = this.getTransform();
        calls.push({
          src: image.src,
          x: transform.e,
          y: transform.f,
          scale: transform.a,
          args,
        });
      }
      drawImage.apply(this, [image, ...args] as Parameters<typeof drawImage>);
    };
    const active = {
      ...base,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
      activeTicks: 0,
    };
    let previous = active;
    const show = (current: typeof active, interpolation = 1) => {
      calls.length = 0;
      presentation.present({ previous, current, interpolation, events: [] });
      previous = current;
      return {
        hero: calls.find((call) => call.src.includes("_Hero/")),
        enemy: calls.find((call) => call.src.includes("_EnemyGoblin/")),
      };
    };
    try {
      const running = show(active);
      const next = show({ ...active, steps: 1, activeTicks: 1 });
      const battle = {
        ...active,
        steps: 2,
        activeTicks: 2,
        battle: {
          enemy: { id: "goblin" as const, maximumHp: 100, currentHp: 100 },
          actors: {
            hero: { phase: "move" as const, x: 50 },
            enemy: { phase: "move" as const, x: 250 },
          },
        },
      };
      const entry = show(battle, 0);
      const attackState = {
        ...battle,
        steps: 3,
        activeTicks: 3,
        battle: {
          ...battle.battle,
          actors: {
            ...battle.battle.actors,
            hero: { phase: "attack" as const, x: 190 },
          },
        },
      };
      const attack = show(attackState);
      const slash = show({ ...attackState, steps: 9, activeTicks: 9 });
      const paused = show({
        ...attackState,
        steps: 10,
        activeTicks: 9,
        lifecycle: { ...active.lifecycle, paused: true },
      });
      const resumed = show({ ...attackState, steps: 20, activeTicks: 9 });
      const exit = show({ ...active, steps: 21, activeTicks: 10 });
      const travel = show({
        ...active,
        steps: 22,
        activeTicks: 11,
        distance: active.distance + 20,
      });
      presentation.setReducedMotion(true);
      const reduced = show({
        ...active,
        steps: 23,
        activeTicks: 12,
        distance: active.distance + 21,
      });
      return {
        running,
        next,
        entry,
        attack,
        slash,
        paused,
        resumed,
        exit,
        travel,
        reduced,
      };
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = drawImage;
    }
  }, "/src/browser/canvas-presentation.ts");
  expect(result.running.hero?.src).toMatch(/_Hero\/17.png/);
  expect(result.next.hero?.src).toMatch(/_Hero\/18.png/);
  expect(result.entry.hero?.x).toBe(result.running.hero?.x);
  expect(result.entry.hero?.y).toBe(result.running.hero?.y);
  expect(result.entry.enemy?.scale).toBe(-1);
  expect(result.attack.hero?.src).toMatch(/_Hero\/34.png/);
  expect(result.slash.hero?.src).toMatch(/_Hero\/40.png/);
  expect(result.slash.hero?.args).toEqual(result.attack.hero?.args);
  expect(result.paused.hero?.src).toBe(result.slash.hero?.src);
  expect(result.resumed.hero?.src).toBe(result.slash.hero?.src);
  expect(result.exit.hero?.x).toBe(190);
  expect(result.travel.hero?.x).toBe(170);
  expect(result.reduced.hero?.src).toMatch(/_Hero\/17.png/);
  await testInfo.attach("original-running-pose.png", {
    body: await page.locator("#animation-test").screenshot(),
    contentType: "image/png",
  });
});

test("omits failed images and never requests the authored atlas", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/assets/original/**", (route) =>
    route.request().resourceType() === "image"
      ? route.abort()
      : route.continue(),
  );
  await page.goto("/?manual=1");
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.locator("#game-canvas")).toHaveAttribute(
    "data-asset-status",
    "unavailable",
  );
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  expect(requests.some((url) => url.includes("world-atlas.svg"))).toBe(false);
  const pixel = await page
    .locator("#game-canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d")!;
      return Array.from(
        context.getImageData(
          Math.floor(canvas.width / 4),
          Math.floor(canvas.height / 3),
          1,
          1,
        ).data,
      );
    });
  expect(pixel).toEqual([5, 7, 13, 255]);
});
