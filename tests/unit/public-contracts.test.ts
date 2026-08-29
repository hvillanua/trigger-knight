import { describe, expectTypeOf, it } from "vitest";

import type {
  BattleEncounter,
  EncounterGenerationState,
  EncounterQueueState,
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  GameplayExecution,
  GameplayTrace,
  GameplayTraceComparison,
  PlayerAgent,
  PlayerPolicy,
  PolicyConfig,
  PolicyDescriptor,
  PresentationFrame,
  PresentationPort,
  ProfileState,
  RandomState,
  RuleSetId,
  RunConfig,
  RunResult,
  RunState,
  ShopEncounter,
  ShopId,
  SimulationRequest,
  SimulationRunner,
  StepResult,
} from "../../src/application/contracts.js";

describe("public application contracts", () => {
  it("exposes one gameplay engine boundary to browser and simulation consumers", () => {
    interface BrowserConsumer {
      readonly engine: GameplayEngine;
      readonly presentation: PresentationPort;
    }

    interface SimulationConsumer {
      readonly engine: GameplayEngine;
      readonly runner: SimulationRunner;
    }

    expectTypeOf<BrowserConsumer["engine"]>().toEqualTypeOf<
      SimulationConsumer["engine"]
    >();
    expectTypeOf<keyof GameplayEngine>().toEqualTypeOf<
      "createRun" | "step" | "observe"
    >();
    expectTypeOf<GameplayEngine["createRun"]>().toEqualTypeOf<
      (config: RunConfig) => RunState
    >();
    expectTypeOf<GameplayEngine["step"]>().toEqualTypeOf<
      (
        state: Readonly<RunState>,
        commands: readonly GameCommand[],
      ) => StepResult
    >();
    expectTypeOf<GameplayEngine["observe"]>().toEqualTypeOf<
      (state: Readonly<RunState>) => GameObservation
    >();
    expectTypeOf<StepResult["events"]>().toEqualTypeOf<readonly GameEvent[]>();
    expectTypeOf<GameCommand>().toEqualTypeOf<
      | Readonly<{ type: "dismiss-tutorial" }>
      | Readonly<{ type: "purchase-current-encounter" }>
      | Readonly<{ type: "toggle-pause" }>
    >();
  });

  it("gives presentation the shared read-only game observation", () => {
    expectTypeOf<PresentationFrame>().toMatchTypeOf<{
      readonly previous: Readonly<GameObservation>;
      readonly current: Readonly<GameObservation>;
      readonly interpolation: number;
      readonly events: readonly GameEvent[];
    }>();
    expectTypeOf<PresentationPort["present"]>().toEqualTypeOf<
      (frame: PresentationFrame) => void
    >();
  });

  it("exposes structured authoritative execution diagnostics", () => {
    expectTypeOf<keyof GameplayExecution>().toEqualTypeOf<
      "dispatch" | "readCurrentCheckpoint" | "readDiagnostics"
    >();
    expectTypeOf<GameplayTrace>().toMatchTypeOf<{
      readonly schemaVersion: 2;
      readonly config: Readonly<RunConfig>;
      readonly checkpoints: readonly {
        readonly index: number;
        readonly commands: readonly GameCommand[];
        readonly state: Readonly<RunState>;
        readonly observation: Readonly<GameObservation>;
        readonly events: readonly GameEvent[];
        readonly checkpointHash: string;
      }[];
      readonly traceHash: string;
    }>();
    expectTypeOf<GameplayTraceComparison>().toMatchTypeOf<
      | Readonly<{ equal: true }>
      | Readonly<{
          equal: false;
          difference: Readonly<{
            path: string;
            expected: unknown;
            actual: unknown;
          }>;
        }>
    >();
  });

  it("defines reproducible policy and finite simulation boundaries", () => {
    expectTypeOf<PolicyDescriptor>().toMatchTypeOf<{
      readonly id: string;
      readonly version: string;
      readonly config: PolicyConfig;
    }>();
    expectTypeOf<PlayerAgent["decide"]>().toEqualTypeOf<
      (
        observation: Readonly<GameObservation>,
        events: readonly GameEvent[],
      ) => readonly GameCommand[]
    >();
    expectTypeOf<Parameters<PlayerAgent["decide"]>[0]>().toEqualTypeOf<
      PresentationFrame["current"]
    >();
    expectTypeOf<Parameters<PlayerAgent["decide"]>[1]>().toEqualTypeOf<
      PresentationFrame["events"]
    >();
    expectTypeOf<PlayerPolicy["createAgent"]>().toEqualTypeOf<
      () => PlayerAgent
    >();
    expectTypeOf<SimulationRequest>().toMatchTypeOf<{
      readonly config: RunConfig;
      readonly policy: PlayerPolicy;
      readonly maxSteps: number;
    }>();
    expectTypeOf<SimulationRunner["run"]>().toEqualTypeOf<
      (request: SimulationRequest) => RunResult
    >();
    expectTypeOf<SimulationRunner["runBatch"]>().toEqualTypeOf<
      (requests: readonly SimulationRequest[]) => Promise<readonly RunResult[]>
    >();
  });

  it("identifies normalized run results with their reproducibility inputs", () => {
    expectTypeOf<ShopId>().toEqualTypeOf<
      | "bladesmith"
      | "armorsmith"
      | "soul-shrine"
      | "pharmacy"
      | "grims-shop"
      | "voucher-store"
    >();
    expectTypeOf<ShopEncounter>().toMatchTypeOf<{
      readonly kind: "shop";
      readonly shop: ShopId;
      readonly cachedPrice: number;
    }>();
    expectTypeOf<BattleEncounter>().toEqualTypeOf<
      Readonly<{ kind: "battle" }>
    >();
    expectTypeOf<EncounterQueueState>().toMatchTypeOf<{
      readonly current:
        | Readonly<{
            kind: "shop";
            shop: ShopId;
            cachedPrice: number;
            x: number;
            used: boolean;
          }>
        | Readonly<{ kind: "battle"; x: number }>
        | null;
      readonly distanceUntilNext: number;
      readonly upcoming: readonly (ShopEncounter | BattleEncounter)[];
      readonly generation: EncounterGenerationState;
    }>();
    expectTypeOf<RunResult>().toMatchTypeOf<{
      readonly schemaVersion: number;
      readonly ruleset: RuleSetId;
      readonly seed: string;
      readonly initialProfileFingerprint: string;
      readonly policy: PolicyDescriptor;
      readonly maxSteps: number;
      readonly steps: number;
      readonly activeTicks: number;
      readonly terminalReason: "lifespan" | "combat" | "step-limit";
      readonly score: number;
      readonly day: number;
      readonly distance: number;
      readonly gold: number;
      readonly traceHash: string;
      readonly metrics: Readonly<Record<string, number>>;
    }>();
    expectTypeOf<RunConfig>().toMatchTypeOf<{
      readonly ruleset: RuleSetId;
      readonly seed: string;
      readonly initialProfile: ProfileState;
    }>();
    expectTypeOf<RunState>().toMatchTypeOf<{
      readonly schemaVersion: 8;
      readonly ruleset: RuleSetId;
      readonly random: RandomState;
      readonly steps: number;
      readonly activeTicks: number;
      readonly scoreMultiplier: number;
      readonly movementSpeed: number;
      readonly distance: number;
      readonly day: number;
      readonly score: number;
      readonly lifespan: {
        readonly whole: number;
        readonly fraction: number;
      };
      readonly player: {
        readonly gold: number;
        readonly weapon: { readonly tier: number; readonly attack: number };
        readonly armor: { readonly tier: number };
        readonly hp: { readonly current: number; readonly maximum: number };
        readonly inventory: {
          readonly item: "elixir" | "divine-edge" | "gold-voucher" | null;
        };
      };
      readonly encounters: {
        readonly current:
          | Readonly<{
              kind: "shop";
              shop:
                | "bladesmith"
                | "armorsmith"
                | "soul-shrine"
                | "pharmacy"
                | "grims-shop"
                | "voucher-store";
              cachedPrice: number;
              x: number;
              used: boolean;
            }>
          | Readonly<{ kind: "battle"; x: number }>
          | null;
        readonly distanceUntilNext: number;
        readonly upcoming: readonly (
          | Readonly<{
              kind: "shop";
              shop:
                | "bladesmith"
                | "armorsmith"
                | "soul-shrine"
                | "pharmacy"
                | "grims-shop"
                | "voucher-store";
              cachedPrice: number;
            }>
          | Readonly<{ kind: "battle" }>
        )[];
        readonly generation: {
          readonly shopsUntilBattle: number;
          readonly seenSinceBattle: {
            readonly bladesmith: boolean;
            readonly armorsmith: boolean;
            readonly soulShrine: boolean;
          };
        };
      };
      readonly lifecycle: {
        readonly phase: "running" | "battle-handoff" | "ended";
        readonly terminalReason: "lifespan" | "combat" | null;
        readonly paused: boolean;
        readonly tutorialPage: 0 | null;
        readonly pregameStepsRemaining: number;
      };
    }>();
    expectTypeOf<GameObservation>().toMatchTypeOf<{
      readonly ruleset: RuleSetId;
      readonly camera: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      };
      readonly steps: number;
      readonly activeTicks: number;
      readonly movementSpeed: number;
      readonly distance: number;
      readonly day: number;
      readonly score: number;
      readonly lifespan: {
        readonly whole: number;
        readonly fraction: number;
      };
      readonly player: {
        readonly gold: number;
        readonly weapon: { readonly tier: number; readonly attack: number };
        readonly armor: { readonly tier: number };
        readonly hp: { readonly current: number; readonly maximum: number };
        readonly inventory: {
          readonly item: "elixir" | "divine-edge" | "gold-voucher" | null;
        };
      };
      readonly encounters: {
        readonly current:
          | Readonly<{
              kind: "shop";
              shop: ShopId;
              cachedPrice: number;
              x: number;
              used: boolean;
            }>
          | Readonly<{ kind: "battle"; x: number }>
          | null;
        readonly upcoming: readonly (ShopEncounter | BattleEncounter)[];
      };
      readonly lifecycle: {
        readonly phase: "running" | "battle-handoff" | "ended";
        readonly terminalReason: "lifespan" | "combat" | null;
        readonly paused: boolean;
        readonly tutorialPage: 0 | null;
        readonly pregameStepsRemaining: number;
        readonly activeGameplay: boolean;
      };
      readonly actions: {
        readonly canTogglePause: boolean;
        readonly canDismissTutorial: boolean;
        readonly canPurchaseCurrentEncounter: boolean;
      };
    }>();
    expectTypeOf<GameEvent>().toEqualTypeOf<
      | Readonly<{ type: "battle-handoff" }>
      | Readonly<{
          type: "encounter-promoted";
          encounter:
            | Readonly<{
                kind: "shop";
                shop: ShopId;
                cachedPrice: number;
                x: number;
                used: boolean;
              }>
            | Readonly<{ kind: "battle"; x: number }>;
        }>
      | Readonly<{ type: "lifespan-death" }>
      | Readonly<{ type: "pause-toggled"; paused: boolean }>
      | Readonly<{
          type: "purchase-rejected";
          reason:
            | "already-used"
            | "insufficient-gold"
            | "lifecycle-gated"
            | "no-current-shop"
            | "out-of-range"
            | "shop-effect-unavailable";
        }>
      | Readonly<{ type: "run-ended"; reason: "lifespan" | "combat" }>
      | Readonly<{
          type: "shop-purchased";
          shop: ShopId;
          price: number;
        }>
      | Readonly<{ type: "step-advanced"; step: number }>
      | Readonly<{ type: "shop-departed"; shop: ShopId }>
      | Readonly<{ type: "tutorial-dismissed"; page: 0 }>
    >();
  });
});
