import type {
  CompletedRunSettlementInput,
  GameEvent,
  ProfileInput,
  ProfileState,
  RunConfig,
  RunResult,
  TutorialPage,
} from "../../src/application/contracts.js";
import type {
  GameplayCheckpoint,
  GameplayTrace,
} from "../../src/application/contracts.js";

export const ORIGINAL_V13_CORPUS_SCHEMA_VERSION = 1 as const;
export const ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION = 2 as const;
export const ORIGINAL_V13_GAMEPLAY_TRACE_SCHEMA_VERSION = 2 as const;
export const ORIGINAL_V13_RUN_STATE_SCHEMA_VERSION = 17 as const;

export type OriginalV13BaselineRunResult = Omit<
  RunResult,
  "metrics" | "schemaVersion"
> & {
  readonly schemaVersion: typeof ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION;
  readonly metrics: Readonly<Record<string, number>>;
};

export type CompatibilityPolicyKey =
  "original-lifecycle" | "combat-shopper" | "non-progressing" | "purchasing";

export interface CompatibilityPolicyInput {
  readonly kind: "named-policy";
  readonly key: CompatibilityPolicyKey;
  readonly descriptor: Readonly<RunResult["policy"]>;
}

export interface CompatibilityStateSummary {
  readonly schemaVersion: typeof ORIGINAL_V13_RUN_STATE_SCHEMA_VERSION;
  readonly steps: number;
  readonly activeTicks: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly gold: number;
  readonly phase: "running" | "battling" | "ended";
  readonly terminalReason: "lifespan" | "combat" | null;
  readonly tutorialPage: TutorialPage | null;
  readonly randomState: number;
}

export interface CompatibilityObservationSummary {
  readonly steps: number;
  readonly activeTicks: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly gold: number;
  readonly phase: CompatibilityStateSummary["phase"];
  readonly terminalReason: CompatibilityStateSummary["terminalReason"];
  readonly tutorialPage: TutorialPage | null;
}

export interface CompatibilityCheckpointExpectation {
  readonly index: number;
  readonly checkpointHash: string;
  readonly state: CompatibilityStateSummary;
  readonly observation: CompatibilityObservationSummary;
  readonly eventTypes: readonly GameEvent["type"][];
}

export interface CompatibilityRunExpectation {
  readonly result: OriginalV13BaselineRunResult;
  readonly traceHash: string;
  readonly checkpoints: readonly CompatibilityCheckpointExpectation[];
  readonly tutorialPages: readonly TutorialPage[];
  readonly completedProfile?: ProfileState;
}

export interface CompatibilityRunFixture {
  readonly id: string;
  readonly execution: "uninterrupted-generated-run";
  readonly provenance: "seeded-clean-room-evidence";
  readonly config: RunConfig;
  readonly policy: CompatibilityPolicyInput;
  readonly maxSteps: number;
  readonly expected: CompatibilityRunExpectation;
}

export interface CompatibilitySettlementFixture {
  readonly id: string;
  readonly execution: "constructed-boundary-scenario";
  readonly provenance: "derived-clean-room-scenario";
  readonly ruleset: "original-v1.3";
  readonly seed: string;
  readonly initialProfiles: readonly [ProfileState, ProfileState];
  readonly runs: readonly [
    CompletedRunSettlementInput,
    CompletedRunSettlementInput,
  ];
  readonly expectedProfiles: readonly [ProfileState, ProfileState];
}

/**
 * Projects the retained v2 result envelope for baseline comparison. The
 * compatibility corpus remains frozen while current simulation results carry
 * the separately versioned metrics extension.
 */
export function toOriginalV13BaselineResult(
  result: RunResult,
): OriginalV13BaselineRunResult {
  return Object.freeze({
    ...result,
    schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
    metrics: Object.freeze({}),
  });
}

function checkpoint(
  index: number,
  checkpointHash: string,
  state: Omit<CompatibilityStateSummary, "schemaVersion">,
  eventTypes: readonly GameEvent["type"][],
): CompatibilityCheckpointExpectation {
  return {
    index,
    checkpointHash,
    state: {
      schemaVersion: ORIGINAL_V13_RUN_STATE_SCHEMA_VERSION,
      ...state,
    },
    observation: {
      steps: state.steps,
      activeTicks: state.activeTicks,
      movementSpeed: state.movementSpeed,
      distance: state.distance,
      day: state.day,
      score: state.score,
      gold: state.gold,
      phase: state.phase,
      terminalReason: state.terminalReason,
      tutorialPage: state.tutorialPage,
    },
    eventTypes,
  };
}

const lifecycleProfile: ProfileInput = Object.freeze({
  schemaVersion: 1,
  scoreMultiplier: 1,
  tutorialPreference: "disabled",
});

const enabledProfile: ProfileInput = Object.freeze({
  schemaVersion: 1,
  scoreMultiplier: 1,
  tutorialPreference: "enabled",
});

const namedPolicies = Object.freeze({
  originalLifecycle: Object.freeze({
    kind: "named-policy" as const,
    key: "original-lifecycle" as const,
    descriptor: Object.freeze({
      id: "milestone-2-lifecycle",
      version: "1",
      config: Object.freeze({}),
    }),
  }),
  combatShopper: Object.freeze({
    kind: "named-policy" as const,
    key: "combat-shopper" as const,
    descriptor: Object.freeze({
      id: "combat-shopper",
      version: "1",
      config: Object.freeze({ elixirHpFraction: 0.5 }),
    }),
  }),
  nonProgressing: Object.freeze({
    kind: "named-policy" as const,
    key: "non-progressing" as const,
    descriptor: Object.freeze({
      id: "non-progressing",
      version: "1",
      config: Object.freeze({}),
    }),
  }),
  purchasing: Object.freeze({
    kind: "named-policy" as const,
    key: "purchasing" as const,
    descriptor: Object.freeze({
      id: "purchase-reachable-shops",
      version: "2",
      config: Object.freeze({}),
    }),
  }),
});

const lifecycleResult: OriginalV13BaselineRunResult = Object.freeze({
  schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ruleset: "original-v1.3",
  seed: "milestone-2-lifecycle-2",
  initialProfileFingerprint:
    "sha256-v1:70e9e848fd1e2cb5add6f527a071ebadbc71f826eee019ad845f3d27c3a9051c",
  policy: namedPolicies.originalLifecycle.descriptor,
  maxSteps: 3_000,
  steps: 2_564,
  activeTicks: 2_500,
  terminalReason: "lifespan",
  score: 320_200,
  day: 4,
  distance: 25_410,
  gold: 700,
  traceHash:
    "sha256-v1:47ff92b92b4602e8587297130536b1258ba6ce2849dbe374a64dba0fe4e18f0b",
  metrics: Object.freeze({}),
});

const combatResult: OriginalV13BaselineRunResult = Object.freeze({
  schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ruleset: "original-v1.3",
  seed: "m4-policy-2211",
  initialProfileFingerprint:
    "sha256-v1:70e9e848fd1e2cb5add6f527a071ebadbc71f826eee019ad845f3d27c3a9051c",
  policy: namedPolicies.combatShopper.descriptor,
  maxSteps: 30_000,
  steps: 14_800,
  activeTicks: 14_740,
  terminalReason: "combat",
  score: 3_088_850,
  day: 22,
  distance: 152_925,
  gold: 8_152,
  traceHash:
    "sha256-v1:4c6866696842ebe67f8998112f3511a71de62a498871624bb26c2b3c618cd6d1",
  metrics: Object.freeze({}),
});

const stepLimitResult: OriginalV13BaselineRunResult = Object.freeze({
  schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ruleset: "original-v1.3",
  seed: "m6-04-step-limit",
  initialProfileFingerprint:
    "sha256-v1:812de3f92a6a4b15bafcce4d3a09fbce6b5be1f6dd73ff20637f18b2aa8036eb",
  policy: namedPolicies.nonProgressing.descriptor,
  maxSteps: 5,
  steps: 5,
  activeTicks: 0,
  terminalReason: "step-limit",
  score: 0,
  day: 1,
  distance: 0,
  gold: 300,
  traceHash:
    "sha256-v1:3c57eb4b08b3eb0c942f120dc7e0424d006e3635ebad888bcfedb8a8badf8113",
  metrics: Object.freeze({}),
});

const tutorialEnabledResult: OriginalV13BaselineRunResult = Object.freeze({
  schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ruleset: "original-v1.3",
  seed: "m6-04-tutorial-preference",
  initialProfileFingerprint:
    "sha256-v1:812de3f92a6a4b15bafcce4d3a09fbce6b5be1f6dd73ff20637f18b2aa8036eb",
  policy: namedPolicies.purchasing.descriptor,
  maxSteps: 2_200,
  steps: 2_200,
  activeTicks: 2_140,
  terminalReason: "step-limit",
  score: 291_500,
  day: 4,
  distance: 23_280,
  gold: 10,
  traceHash:
    "sha256-v1:3c24e0a2477b823c99069f2bbd43d7428149d385cf250a493c4bd140a2ceb707",
  metrics: Object.freeze({}),
});

const tutorialDisabledResult: OriginalV13BaselineRunResult = Object.freeze({
  schemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ruleset: "original-v1.3",
  seed: "m6-04-tutorial-preference",
  initialProfileFingerprint:
    "sha256-v1:70e9e848fd1e2cb5add6f527a071ebadbc71f826eee019ad845f3d27c3a9051c",
  policy: namedPolicies.purchasing.descriptor,
  maxSteps: 2_200,
  steps: 2_200,
  activeTicks: 2_140,
  terminalReason: "step-limit",
  score: 291_500,
  day: 4,
  distance: 23_280,
  gold: 10,
  traceHash:
    "sha256-v1:91d81a17ed2e57dadac6f081291f302f8aecfa83d49e731013ce2486eedd4039",
  metrics: Object.freeze({}),
});

const lifecycleExpectedProfile: ProfileState = Object.freeze({
  schemaVersion: 2,
  level: 1,
  xp: 66,
  scoreMultiplier: 1,
  highScore: 320_200,
  tutorialPreference: "disabled",
  weaponDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([false, false, false, false, false, false]),
});

const combatExpectedProfile: ProfileState = Object.freeze({
  schemaVersion: 2,
  level: 10,
  xp: 255,
  scoreMultiplier: 2,
  highScore: 3_088_850,
  tutorialPreference: "disabled",
  weaponDiscoveries: Object.freeze(Array<boolean>(10).fill(true)),
  armorDiscoveries: Object.freeze(Array<boolean>(10).fill(true)),
  achievementSlots: Object.freeze([true, true, true, true, true, false]),
});

export const originalV13CompatibilityRuns = Object.freeze([
  {
    id: "lifespan-death-with-pause-and-initial-tutorial",
    execution: "uninterrupted-generated-run" as const,
    provenance: "seeded-clean-room-evidence" as const,
    config: Object.freeze({
      ruleset: "original-v1.3" as const,
      seed: "milestone-2-lifecycle-2",
      initialProfile: lifecycleProfile,
    }),
    policy: namedPolicies.originalLifecycle,
    maxSteps: 3_000,
    expected: {
      result: lifecycleResult,
      traceHash:
        "sha256-v1:7da796b90927efa35b26cd2ee04bb4b8d359c790623cf216a69daa71a8b1c202",
      tutorialPages: [0],
      completedProfile: lifecycleExpectedProfile,
      checkpoints: [
        checkpoint(
          0,
          "sha256-v1:e67da40c49c52a1308471dec8e60c97a15fa7cb5f653abf6a46d210a1a9ca12a",
          {
            steps: 0,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_114_442_936,
          },
          [],
        ),
        checkpoint(
          1,
          "sha256-v1:ba9383a405175aeae24518b430ae20222aed19e66732e7c0a8fe09271ef82a31",
          {
            steps: 1,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_114_442_936,
          },
          ["step-advanced"],
        ),
        checkpoint(
          72,
          "sha256-v1:9ea24b514204f9468b6d8143b2143da136c26358abb924bb404a01095a1ff528",
          {
            steps: 72,
            activeTicks: 10,
            movementSpeed: 10,
            distance: 55,
            day: 1,
            score: 550,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_114_442_936,
          },
          ["pause-toggled", "step-advanced"],
        ),
        checkpoint(
          75,
          "sha256-v1:545ea94a689c40d685d8f810007c015d49a3bf19753b698868eb21db737e6c9d",
          {
            steps: 75,
            activeTicks: 11,
            movementSpeed: 11,
            distance: 66,
            day: 1,
            score: 660,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_114_442_936,
          },
          ["pause-toggled", "step-advanced"],
        ),
        checkpoint(
          2_564,
          "sha256-v1:1ccba5dd0b4445031038c4de37138fcd7035e4be5ce5e3883d0055a92ffb4c36",
          {
            steps: 2_564,
            activeTicks: 2_500,
            movementSpeed: 15,
            distance: 25_410,
            day: 4,
            score: 320_200,
            gold: 700,
            phase: "ended",
            terminalReason: "lifespan",
            tutorialPage: null,
            randomState: 595_337_060,
          },
          ["step-advanced", "lifespan-death", "run-ended"],
        ),
      ],
    },
  },
  {
    id: "combat-death-with-shops-items-enemies-and-achievements",
    execution: "uninterrupted-generated-run" as const,
    provenance: "seeded-clean-room-evidence" as const,
    config: Object.freeze({
      ruleset: "original-v1.3" as const,
      seed: "m4-policy-2211",
      initialProfile: lifecycleProfile,
    }),
    policy: namedPolicies.combatShopper,
    maxSteps: 30_000,
    expected: {
      result: combatResult,
      traceHash:
        "sha256-v1:e324e06154aac73eff2bfff4d4fd6eff04a59ac9678c8407373311adf000bd0c",
      tutorialPages: [0],
      completedProfile: combatExpectedProfile,
      checkpoints: [
        checkpoint(
          0,
          "sha256-v1:a2a6e5a2ad74a051c17bd08284f27d5360fca156029a2155f69e95663c934d2a",
          {
            steps: 0,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 2_623_889_770,
          },
          [],
        ),
        checkpoint(
          1,
          "sha256-v1:0378f838ae2f2bff5159cdf8dea3b631f9f278bceb832818f535fc6bb26889bb",
          {
            steps: 1,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 2_623_889_770,
          },
          ["tutorial-dismissed", "step-advanced"],
        ),
        checkpoint(
          214,
          "sha256-v1:4f25df996b1991229e336122178405a0124727b7529419c9f502d4f0e279a468",
          {
            steps: 214,
            activeTicks: 154,
            movementSpeed: 15,
            distance: 2_205,
            day: 1,
            score: 22_050,
            gold: 64,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_992_054_100,
          },
          ["shop-purchased", "equipment-discovered", "step-advanced"],
        ),
        checkpoint(
          320,
          "sha256-v1:63cb5f771da5ccea891e57f58e5e46fe67d5275f4f0b0376a03ce5474ac3d073",
          {
            steps: 320,
            activeTicks: 260,
            movementSpeed: 15,
            distance: 3_795,
            day: 1,
            score: 37_950,
            gold: 64,
            phase: "battling",
            terminalReason: null,
            tutorialPage: null,
            randomState: 728_382_760,
          },
          ["step-advanced", "battle-started"],
        ),
        checkpoint(
          439,
          "sha256-v1:e9b9c890c08f417ff025f8e7947cc2a788dbc0f1f706eb8d3cba59dd5b3a99fc",
          {
            steps: 439,
            activeTicks: 379,
            movementSpeed: 0,
            distance: 3_795,
            day: 1,
            score: 51_890,
            gold: 156,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_232_336_036,
          },
          ["step-advanced", "battle-reward"],
        ),
        checkpoint(
          6_144,
          "sha256-v1:10e602d37f409b4841a13f2e1cf62ad7c69fc9a02916036357b05b5bccc0cea6",
          {
            steps: 6_144,
            activeTicks: 6_084,
            movementSpeed: 15,
            distance: 63_000,
            day: 10,
            score: 927_100,
            gold: 214,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 3_601_491_122,
          },
          ["step-advanced", "achievement-unlocked"],
        ),
        checkpoint(
          14_800,
          "sha256-v1:db52479251c08cf1e7e5388ec353ddb7026c2d0bb0e2b7c4902a5f3e34defe0c",
          {
            steps: 14_800,
            activeTicks: 14_740,
            movementSpeed: 0,
            distance: 152_925,
            day: 22,
            score: 3_088_850,
            gold: 8_152,
            phase: "ended",
            terminalReason: "combat",
            tutorialPage: null,
            randomState: 1_028_690_642,
          },
          ["step-advanced", "run-ended"],
        ),
      ],
    },
  },
  {
    id: "gated-step-limit-does-not-settle",
    execution: "uninterrupted-generated-run" as const,
    provenance: "seeded-clean-room-evidence" as const,
    config: Object.freeze({
      ruleset: "original-v1.3" as const,
      seed: "m6-04-step-limit",
      initialProfile: enabledProfile,
    }),
    policy: namedPolicies.nonProgressing,
    maxSteps: 5,
    expected: {
      result: stepLimitResult,
      traceHash:
        "sha256-v1:4367a08693468263ccb4bef9af5e5fe9e783975b9ddb6f6219c573c4820d5ef9",
      tutorialPages: [0],
      checkpoints: [
        checkpoint(
          0,
          "sha256-v1:639340e04696b1f51731597cd9b9bda8548439c2e0210729058ccc56c458219d",
          {
            steps: 0,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_527_009_395,
          },
          [],
        ),
        checkpoint(
          1,
          "sha256-v1:15e74b8626b7d6e964789ed91f199ae00483b8a4e81e390b2cadcfb41dcb30e8",
          {
            steps: 1,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_527_009_395,
          },
          ["step-advanced"],
        ),
        checkpoint(
          5,
          "sha256-v1:70cb257e8776a62a2ef8462e490d590e0195abb8acbed8858eed45e72582c5fe",
          {
            steps: 5,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_527_009_395,
          },
          ["step-advanced"],
        ),
      ],
    },
  },
  {
    id: "contextual-tutorials-enabled",
    execution: "uninterrupted-generated-run" as const,
    provenance: "seeded-clean-room-evidence" as const,
    config: Object.freeze({
      ruleset: "original-v1.3" as const,
      seed: "m6-04-tutorial-preference",
      initialProfile: enabledProfile,
    }),
    policy: namedPolicies.purchasing,
    maxSteps: 2_200,
    expected: {
      result: tutorialEnabledResult,
      traceHash:
        "sha256-v1:d102d29c5c837783d94917c5c71c6c298b700c383a943cf836257b0923db24f5",
      tutorialPages: [0, 3, 1, 4, 2],
      checkpoints: [
        checkpoint(
          0,
          "sha256-v1:788725b627951d6c1e3e9647182b6e468a82eb872f02bcf8832f0a5572f0a9b0",
          {
            steps: 0,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_684_882_120,
          },
          [],
        ),
        checkpoint(
          1,
          "sha256-v1:7d42a6285a992f5220650795b37efcf0a7b563733b3fa80089ca8124a8399592",
          {
            steps: 1,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_684_882_120,
          },
          ["tutorial-dismissed", "step-advanced"],
        ),
        checkpoint(
          61,
          "sha256-v1:469754be3921abc82fe73e8b5bd35aa45ebc4c68d93aa48e49e5fad41ddae0a9",
          {
            steps: 61,
            activeTicks: 1,
            movementSpeed: 1,
            distance: 1,
            day: 1,
            score: 10,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_684_882_120,
          },
          ["step-advanced"],
        ),
        checkpoint(
          2_200,
          "sha256-v1:bb60a0537c70b9dc1fbaf4c9808707449bd9883679bc76878784d490d633e97c",
          {
            steps: 2_200,
            activeTicks: 2_140,
            movementSpeed: 0,
            distance: 23_280,
            day: 4,
            score: 291_500,
            gold: 10,
            phase: "battling",
            terminalReason: null,
            tutorialPage: null,
            randomState: 853_646_559,
          },
          ["step-advanced", "combat-phase-changed"],
        ),
      ],
    },
  },
  {
    id: "contextual-tutorials-disabled",
    execution: "uninterrupted-generated-run" as const,
    provenance: "seeded-clean-room-evidence" as const,
    config: Object.freeze({
      ruleset: "original-v1.3" as const,
      seed: "m6-04-tutorial-preference",
      initialProfile: lifecycleProfile,
    }),
    policy: namedPolicies.purchasing,
    maxSteps: 2_200,
    expected: {
      result: tutorialDisabledResult,
      traceHash:
        "sha256-v1:e151cbeb26d2b8cd505d39788edafbe8a705293992ed7c930358772f7f5e1520",
      tutorialPages: [0],
      checkpoints: [
        checkpoint(
          0,
          "sha256-v1:9ad8734f6ed874278813fb6ea1eadd93d5b180fb82c5b4dd2594f7cd0be670e9",
          {
            steps: 0,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: 0,
            randomState: 1_684_882_120,
          },
          [],
        ),
        checkpoint(
          1,
          "sha256-v1:8380700262fb0afe42f9cd9529dfa955728ca062370d8d216ec1f7b8200fd7d5",
          {
            steps: 1,
            activeTicks: 0,
            movementSpeed: 0,
            distance: 0,
            day: 1,
            score: 0,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_684_882_120,
          },
          ["tutorial-dismissed", "step-advanced"],
        ),
        checkpoint(
          61,
          "sha256-v1:98dd0a429fce33170b8f83cb296a0c35b9d726d73780dbac5615d28f0b2e5791",
          {
            steps: 61,
            activeTicks: 1,
            movementSpeed: 1,
            distance: 1,
            day: 1,
            score: 10,
            gold: 300,
            phase: "running",
            terminalReason: null,
            tutorialPage: null,
            randomState: 1_684_882_120,
          },
          ["step-advanced"],
        ),
        checkpoint(
          2_200,
          "sha256-v1:ecb9ee1f1d335ac0149549dbfe4b5265f451acbf53932e819b83011efce7ac3a",
          {
            steps: 2_200,
            activeTicks: 2_140,
            movementSpeed: 0,
            distance: 23_280,
            day: 4,
            score: 291_500,
            gold: 10,
            phase: "battling",
            terminalReason: null,
            tutorialPage: null,
            randomState: 853_646_559,
          },
          ["step-advanced", "combat-phase-changed"],
        ),
      ],
    },
  },
] satisfies readonly CompatibilityRunFixture[]);

const settlementInitialProfile: ProfileState = Object.freeze({
  schemaVersion: 2,
  level: 1,
  xp: 0,
  scoreMultiplier: 1,
  highScore: 0,
  tutorialPreference: "enabled",
  weaponDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([false, false, false, false, false, false]),
});

const firstSettlementProfile: ProfileState = Object.freeze({
  schemaVersion: 2,
  level: 4,
  xp: 0,
  scoreMultiplier: 1.4,
  highScore: 500,
  tutorialPreference: "disabled",
  weaponDiscoveries: Object.freeze([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([true, false, false, false, false, false]),
});

const firstSettlement: CompletedRunSettlementInput = Object.freeze({
  lifecycle: Object.freeze({ phase: "ended", terminalReason: "lifespan" }),
  score: 500,
  profileExpEarned: 486,
  weaponDiscoveries: Object.freeze([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([true, false, false, false, false, false]),
});

const secondSettlement: CompletedRunSettlementInput = Object.freeze({
  lifecycle: Object.freeze({ phase: "ended", terminalReason: "combat" }),
  score: 450,
  profileExpEarned: 4,
  weaponDiscoveries: Object.freeze([
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([true, true, false, false, false, false]),
});

const secondSettlementProfile: ProfileState = Object.freeze({
  schemaVersion: 2,
  level: 4,
  xp: 4,
  scoreMultiplier: 1.4,
  highScore: 500,
  tutorialPreference: "disabled",
  weaponDiscoveries: Object.freeze([
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  armorDiscoveries: Object.freeze([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]),
  achievementSlots: Object.freeze([true, true, false, false, false, false]),
});

export const originalV13CompatibilitySettlements = Object.freeze([
  {
    id: "consecutive-profile-settlements",
    execution: "constructed-boundary-scenario" as const,
    provenance: "derived-clean-room-scenario" as const,
    ruleset: "original-v1.3" as const,
    seed: "m6-04-profile-settlement-sequence",
    initialProfiles: [
      settlementInitialProfile,
      firstSettlementProfile,
    ] as const,
    runs: [firstSettlement, secondSettlement] as const,
    expectedProfiles: [
      firstSettlementProfile,
      secondSettlementProfile,
    ] as const,
  },
] satisfies readonly CompatibilitySettlementFixture[]);

export type OriginalV13CompatibilityRun =
  (typeof originalV13CompatibilityRuns)[number];
export type OriginalV13CompatibilitySettlement =
  (typeof originalV13CompatibilitySettlements)[number];

export function summarizeCheckpoint(checkpoint: GameplayCheckpoint): {
  readonly index: number;
  readonly checkpointHash: string;
  readonly state: CompatibilityStateSummary;
  readonly observation: CompatibilityObservationSummary;
  readonly eventTypes: readonly GameEvent["type"][];
} {
  const { state, observation, events } = checkpoint;
  return {
    index: checkpoint.index,
    checkpointHash: checkpoint.checkpointHash,
    state: {
      schemaVersion: state.schemaVersion,
      steps: state.steps,
      activeTicks: state.activeTicks,
      movementSpeed: state.movementSpeed,
      distance: state.distance,
      day: state.day,
      score: state.score,
      gold: state.player.gold,
      phase: state.lifecycle.phase,
      terminalReason: state.lifecycle.terminalReason,
      tutorialPage: state.lifecycle.tutorialPage,
      randomState: state.random.state,
    },
    observation: {
      steps: observation.steps,
      activeTicks: observation.activeTicks,
      movementSpeed: observation.movementSpeed,
      distance: observation.distance,
      day: observation.day,
      score: observation.score,
      gold: observation.player.gold,
      phase: observation.lifecycle.phase,
      terminalReason: observation.lifecycle.terminalReason,
      tutorialPage: observation.lifecycle.tutorialPage,
    },
    eventTypes: events.map((event) => event.type),
  };
}

export function tutorialPages(trace: GameplayTrace): readonly TutorialPage[] {
  const pages: TutorialPage[] = [];
  for (const checkpoint of trace.checkpoints) {
    const page = checkpoint.observation.lifecycle.tutorialPage;
    if (page !== null && pages.at(-1) !== page) pages.push(page);
  }
  return pages;
}
