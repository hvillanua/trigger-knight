import { expect, test } from "@playwright/test";

import type * as RandomModule from "../../src/domain/random.js";

test("produces unit and bounded integer sequences in Chromium", async ({
  page,
}) => {
  await page.goto("/?manual=1");

  const sequences = await page.evaluate(async () => {
    const modulePath = "/src/domain/random.ts";
    const { createRandomState, nextRandom, nextRandomInteger } = (await import(
      modulePath
    )) as typeof RandomModule;
    let unitState = createRandomState("trigger-knight");
    const unit: number[] = [];

    for (let index = 0; index < 5; index += 1) {
      const draw = nextRandom(unitState);
      unitState = draw.state;
      unit.push(draw.value);
    }

    let integerState = createRandomState("trigger-knight");
    const bounded = [3, 100, 24, 7, 1_000].map((bound) => {
      const draw = nextRandomInteger(integerState, bound);
      integerState = draw.state;
      return draw.value;
    });

    return { unit, bounded };
  });

  expect(sequences).toEqual({
    unit: [
      0.04703454626724124, 0.5048810059670359, 0.8992407298646867,
      0.5932981998194009, 0.4280949376989156,
    ],
    bounded: [0, 50, 21, 4, 428],
  });
});
