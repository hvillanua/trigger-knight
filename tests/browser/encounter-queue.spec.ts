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
    "sha256-v1:e9a33e6a60dcd2f9ad88495fbc43fa98eebb7fc82a9821b2cec8843a57b05da2",
  );
  expect(nodeSnapshot.stateHash).toBe(
    "sha256-v1:5e5827c9b6f98dad42d23579b0550613da40b4bd4d3b28551f6f179aead2dc0e",
  );
});
