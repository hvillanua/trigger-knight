import { describe, expectTypeOf, it } from "vitest";

import type {
  BattleObservation,
  BattleEncounter,
  BattleState,
  EncounterGenerationState,
  EncounterQueueState,
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  GameplayExecution,
  GameplayTrace,
  GameplayTraceComparison,
  ObservedBattleEnemy,
  ObservedPositionedBattleEncounter,
  PlayerAgent,
  PlayerPolicy,
  PolicyConfig,
  PolicyDescriptor,
  PresentationFrame,
  PresentationPort,
  ProfileInput,
  RandomState,
  RuleSetId,
  RunConfig,
  RunResult,
  RunState,
  QueuedBattleEncounter,
  ShopEncounter,
  ShopId,
  SimulationRequest,
  SimulationRunner,
  StepResult,
  UseCarriedItemCommand,
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
      | UseCarriedItemCommand
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
    expectTypeOf<QueuedBattleEncounter>().toMatchTypeOf<{
      readonly kind: "battle";
      readonly enemy: {
        readonly id: "goblin" | "golem" | "wolf" | "dragon";
        readonly maximumHp: number;
        readonly attack: number;
        readonly goldReward: number;
        readonly profileExp: number;
      };
    }>();
    expectTypeOf<EncounterQueueState>().toMatchTypeOf<{
      readonly current:
        | Readonly<{
            kind: "shop";
            shop: ShopId;
            cachedPrice: number;
            x: number;
            used: boolean;
          }>
        | Readonly<{
            kind: "battle";
            enemy: QueuedBattleEncounter["enemy"];
            x: number;
          }>
        | null;
      readonly distanceUntilNext: number;
      readonly upcoming: readonly (ShopEncounter | QueuedBattleEncounter)[];
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
      readonly initialProfile: ProfileInput;
    }>();
    expectTypeOf<RunState>().toMatchTypeOf<{
      readonly schemaVersion: 16;
      readonly ruleset: RuleSetId;
      readonly random: RandomState;
      readonly steps: number;
      readonly activeTicks: number;
      readonly scoreMultiplier: number;
      readonly movementSpeed: number;
      readonly distance: number;
      readonly day: number;
      readonly score: number;
      readonly profileExpEarned: number;
      readonly dragonKills: number;
      readonly weaponDiscoveries: readonly boolean[];
      readonly armorDiscoveries: readonly boolean[];
      readonly achievementSlots: readonly boolean[];
      readonly lifespan: {
        readonly whole: number;
        readonly fraction: number;
      };
      readonly player: {
        readonly gold: number;
        readonly weapon: {
          readonly tier: number;
          readonly name: string;
          readonly attack: number;
        };
        readonly armor: { readonly tier: number; readonly name: string };
        readonly hp: { readonly current: number; readonly maximum: number };
        readonly inventory: {
          readonly item: "elixir" | "divine-edge" | "gold-voucher" | null;
        };
      };
      readonly battle: BattleState | null;
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
          | Readonly<{
              kind: "battle";
              enemy: QueuedBattleEncounter["enemy"];
              x: number;
            }>
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
          | QueuedBattleEncounter
        )[];
        readonly generation: {
          readonly shopsUntilBattle: number;
          readonly dragonSpawned: boolean;
          readonly seenSinceBattle: {
            readonly bladesmith: boolean;
            readonly armorsmith: boolean;
            readonly soulShrine: boolean;
          };
          readonly soulShrine: {
            readonly extensions: number;
            readonly emergencyThreshold: number;
            readonly emergencyChanceGiven: boolean;
          };
        };
      };
      readonly lifecycle: {
        readonly phase: "running" | "battling" | "ended";
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
        readonly weapon: {
          readonly tier: number;
          readonly name: string;
          readonly attack: number;
        };
        readonly armor: { readonly tier: number; readonly name: string };
        readonly hp: { readonly current: number; readonly maximum: number };
        readonly inventory: {
          readonly item: "elixir" | "divine-edge" | "gold-voucher" | null;
        };
      };
      readonly battle: BattleObservation | null;
      readonly encounters: {
        readonly current:
          | Readonly<{
              kind: "shop";
              shop: ShopId;
              cachedPrice: number;
              x: number;
              used: boolean;
            }>
          | Readonly<{
              kind: "battle";
              enemy: ObservedPositionedBattleEncounter["enemy"];
              x: number;
            }>
          | null;
        readonly upcoming: readonly (ShopEncounter | BattleEncounter)[];
      };
      readonly lifecycle: {
        readonly phase: "running" | "battling" | "ended";
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
        readonly canUseCarriedItem: boolean;
      };
    }>();
    expectTypeOf<GameEvent>().toEqualTypeOf<
      | Readonly<{
          type: "achievement-unlocked";
          achievement:
            | "slay-a-dragon"
            | "stashed-3000-gold"
            | "reach-day-10"
            | "get-all-collection"
            | "perform-70000-damage";
        }>
      | Readonly<{
          type: "battle-reward";
          enemy: "goblin" | "golem" | "wolf" | "dragon";
          gold: number;
          score: number;
          profileExp: number;
          dragonKilled: boolean;
        }>
      | Readonly<{
          type: "combat-phase-changed";
          actor: "hero" | "enemy";
          phase: "idle" | "move" | "attack" | "flinch" | "dead";
        }>
      | Readonly<{
          type: "combat-hit";
          attacker: "hero" | "enemy";
          target: "hero" | "enemy";
          damage: number;
          critical: boolean;
          remainingHp: number;
        }>
      | Readonly<{
          type: "combat-lethal-hit";
          attacker: "hero" | "enemy";
          target: "hero" | "enemy";
        }>
      | Readonly<{
          type: "equipment-discovered";
          equipment: "weapon" | "armor";
          tier: number;
        }>
      | Readonly<{
          type: "battle-started";
          enemy: ObservedBattleEnemy;
        }>
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
            | Readonly<{
                kind: "battle";
                enemy: ObservedPositionedBattleEncounter["enemy"];
                x: number;
              }>;
        }>
      | Readonly<{ type: "lifespan-death" }>
      | Readonly<{ type: "pause-toggled"; paused: boolean }>
      | Readonly<{
          type: "purchase-rejected";
          reason:
            | "already-used"
            | "insufficient-gold"
            | "lifecycle-gated"
            | "maximum-tier"
            | "no-current-shop"
            | "out-of-range"
            | "shop-effect-unavailable";
        }>
      | Readonly<{
          type: "item-used";
          item: "elixir" | "divine-edge" | "gold-voucher";
        }>
      | Readonly<{
          type: "item-use-rejected";
          reason: "lifecycle-gated" | "no-current-battle" | "no-item";
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
