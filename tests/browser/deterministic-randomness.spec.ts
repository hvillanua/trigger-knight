import { expect, test } from "@playwright/test";

import type * as RandomModule from "../../src/domain/random.js";

test("produces the versioned deterministic sequence in Chromium", async ({
  page,
}) => {
  await page.goto("/");

  const values = await page.evaluate(async () => {
    const modulePath = "/src/domain/random.ts";
    const { createRandomState, nextRandom } = (await import(
      modulePath
    )) as typeof RandomModule;
    let state = createRandomState("trigger-knight");
    const sequence: number[] = [];

    for (let index = 0; index < 5; index += 1) {
      const draw = nextRandom(state);
      state = draw.state;
      sequence.push(draw.value);
    }

    return sequence;
  });

  expect(values).toEqual([
    0.04703454626724124, 0.5048810059670359, 0.8992407298646867,
    0.5932981998194009, 0.4280949376989156,
  ]);
});
