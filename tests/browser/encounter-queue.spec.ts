import { expect, test } from "@playwright/test";

import type * as CanonicalJsonModule from "../../src/application/canonical-json.js";
import { fingerprintCanonicalJson } from "../../src/application/canonical-json.js";
import type * as GameplayEngineModule from "../../src/application/gameplay-engine.js";
import type * as RuleSetsModule from "../../src/domain/rulesets.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const config = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "encounter-host-parity",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

test("reproduces encounter generation state and hashes in Node and Chromium", async ({
  page,
}) => {
  const nodeState = createTestGameplayEngine().createRun(config);
  const nodeSnapshot = {
    encounters: nodeState.encounters,
    random: nodeState.random,
    encounterHash: fingerprintCanonicalJson(nodeState.encounters),
    stateHash: fingerprintCanonicalJson(nodeState),
  };

  await page.goto("/");
  const chromiumSnapshot = await page.evaluate(async (runConfig) => {
    const enginePath = "/src/application/gameplay-engine.ts";
    const rulesPath = "/src/domain/rulesets.ts";
    const canonicalJsonPath = "/src/application/canonical-json.ts";
    const engineModule = (await import(
      enginePath
    )) as typeof GameplayEngineModule;
    const rulesModule = (await import(rulesPath)) as typeof RuleSetsModule;
    const canonicalJsonModule = (await import(
      canonicalJsonPath
    )) as typeof CanonicalJsonModule;
    const state = engineModule
      .createGameplayEngine(rulesModule.ruleSetRegistry)
      .createRun(runConfig);

    return {
      encounters: state.encounters,
      random: state.random,
      encounterHash: canonicalJsonModule.fingerprintCanonicalJson(
        state.encounters,
      ),
      stateHash: canonicalJsonModule.fingerprintCanonicalJson(state),
    };
  }, config);

  expect(chromiumSnapshot).toEqual(nodeSnapshot);
  expect(nodeSnapshot.encounterHash).toBe(
    "sha256-v1:c4bf0b847f029df30bc8eea291d4d6db844f2f4d3e76077e7de81c08552d2e46",
  );
  expect(nodeSnapshot.stateHash).toBe(
    "sha256-v1:5e7da17860017069ffbdf64acaeafca08c2c242bf36cb58ce2d925e56ff18930",
  );
});
