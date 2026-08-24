import { describe, expect, it, vi } from "vitest";

import {
  gameplayEngine,
  WALKING_SKELETON_RULESET_ID,
} from "../../src/application/gameplay-engine.js";
import type {
  PresentationFrame,
  PresentationPort,
  RunConfig,
} from "../../src/application/contracts.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";

const config: RunConfig = Object.freeze({
  ruleset: WALKING_SKELETON_RULESET_ID,
  seed: "browser-session-seed",
  initialProfile: Object.freeze({ schemaVersion: 1 }),
});

describe("browser gameplay session", () => {
  it("produces the same public result with replaced or disabled presentation", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const presentation: PresentationPort = { present };
    const presented = createBrowserGameplaySession(
      gameplayEngine,
      config,
      presentation,
    );
    const unpresented = createBrowserGameplaySession(gameplayEngine, config);
    const commands = Object.freeze([Object.freeze({ type: "advance" })]);

    const presentedResult = presented.dispatch(commands);
    const unpresentedResult = unpresented.dispatch(commands);

    expect(presentedResult).toEqual(unpresentedResult);
    expect(presentedResult).toEqual({
      observation: { ruleset: WALKING_SKELETON_RULESET_ID, steps: 1 },
      events: [{ type: "step-advanced", step: 1 }],
    });
    expect(present).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenLastCalledWith({
      previous: { ruleset: WALKING_SKELETON_RULESET_ID, steps: 0 },
      current: { ruleset: WALKING_SKELETON_RULESET_ID, steps: 1 },
      interpolation: 1,
      events: [{ type: "step-advanced", step: 1 }],
    });
  });
});
