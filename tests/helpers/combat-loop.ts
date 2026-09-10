import type {
  GameplayTrace,
  RunConfig,
} from "../../src/application/contracts.js";
import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import { ruleSetRegistry } from "../../src/domain/rulesets.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

// Derived clean-room scenarios, not recovered Flash seeds. Original PRNG and
// scheduling gaps remain recorded in docs/compatibility-decisions.md.
export const combatLoopScenarios = [
  { seed: "m4-policy-2211", terminalReason: "combat", steps: 14800 },
  { seed: "m4-policy-3", terminalReason: "lifespan", steps: 4501 },
] as const;

export const combatLoopMaxSteps = 30_000;

export function combatLoopConfig(seed: string): RunConfig {
  return {
    ruleset: "original-v1.3",
    seed,
    initialProfile: {
      schemaVersion: 1,
      scoreMultiplier: 1,
      tutorialPreference: "disabled",
    },
  };
}

export function runCombatLoop(seed: string) {
  let trace: GameplayTrace | undefined;
  const engine = createGameplayEngine(ruleSetRegistry);
  const result = createSimulationRunner(engine, {
    onTrace: (value) => {
      trace = value;
    },
  }).run({
    config: combatLoopConfig(seed),
    policy: createCombatPolicy(),
    maxSteps: combatLoopMaxSteps,
  });
  if (trace === undefined) throw new Error("Expected complete combat trace");
  return { trace, result };
}
