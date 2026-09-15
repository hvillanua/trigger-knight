import { describe, expect, it } from "vitest";

import type { RunConfig } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

function config(seed: string): RunConfig {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile: {
      schemaVersion: 1,
      scoreMultiplier: 1,
      tutorialPreference: "disabled",
    },
  };
}

describe("continuous combat policy runs", () => {
  it("repeats bounded results and records policy configuration as input", () => {
    const runner = createSimulationRunner(engine);
    const request = {
      config: config("m4-policy-repeat"),
      policy: createCombatPolicy(),
      maxSteps: 40,
    };
    const first = runner.run(request);

    expect(runner.run(request)).toEqual(first);

    const defaultResult = runner.run({ ...request, maxSteps: 1 });
    const configuredResult = runner.run({
      ...request,
      maxSteps: 1,
      policy: createCombatPolicy({ elixirHpFraction: 0.25 }),
    });
    expect(configuredResult.policy.config).toEqual({ elixirHpFraction: 0.25 });
    expect(configuredResult.traceHash).not.toBe(defaultResult.traceHash);
  });

  it("bounds gated and unfinished runs with the configured step limit", () => {
    const runner = createSimulationRunner(engine);
    for (const policy of [nonProgressingPolicy, createCombatPolicy()]) {
      expect(
        runner.run({
          config: config("m4-policy-limit"),
          policy,
          maxSteps: 20,
        }),
      ).toMatchObject({ steps: 20, terminalReason: "step-limit" });
    }
  });
});
