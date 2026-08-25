import { describe, expectTypeOf, it } from "vitest";

import type {
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
      readonly schemaVersion: 1;
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
      readonly schemaVersion: 3;
      readonly ruleset: RuleSetId;
      readonly random: RandomState;
      readonly steps: number;
      readonly activeTicks: number;
      readonly scoreMultiplier: number;
      readonly movementSpeed: number;
      readonly distance: number;
      readonly day: number;
      readonly score: number;
      readonly lifecycle: {
        readonly phase: "running" | "ended";
        readonly paused: boolean;
        readonly tutorialPage: 0 | null;
        readonly pregameStepsRemaining: number;
      };
    }>();
    expectTypeOf<GameObservation>().toMatchTypeOf<{
      readonly ruleset: RuleSetId;
      readonly steps: number;
      readonly activeTicks: number;
      readonly movementSpeed: number;
      readonly distance: number;
      readonly day: number;
      readonly score: number;
      readonly lifecycle: {
        readonly phase: "running" | "ended";
        readonly paused: boolean;
        readonly tutorialPage: 0 | null;
        readonly pregameStepsRemaining: number;
        readonly activeGameplay: boolean;
      };
      readonly actions: {
        readonly canTogglePause: boolean;
        readonly canDismissTutorial: boolean;
      };
    }>();
    expectTypeOf<GameEvent>().toEqualTypeOf<
      | Readonly<{ type: "pause-toggled"; paused: boolean }>
      | Readonly<{ type: "step-advanced"; step: number }>
      | Readonly<{ type: "tutorial-dismissed"; page: 0 }>
    >();
  });
});
