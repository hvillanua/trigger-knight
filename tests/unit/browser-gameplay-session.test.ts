import { describe, expect, it, vi } from "vitest";

import type {
  PresentationFrame,
  PresentationPort,
  RunConfig,
} from "../../src/application/contracts.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
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
    expect(presented.readDiagnostics()).toEqual(unpresented.readDiagnostics());
    expect(presentedResult).toEqual({
      observation: { ruleset: ORIGINAL_V13_RULESET_ID, steps: 1 },
      events: [{ type: "step-advanced", step: 1 }],
    });
    expect(present).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenLastCalledWith({
      previous: { ruleset: ORIGINAL_V13_RULESET_ID, steps: 0 },
      current: { ruleset: ORIGINAL_V13_RULESET_ID, steps: 1 },
      interpolation: 1,
      events: [{ type: "step-advanced", step: 1 }],
    });
  });
});
