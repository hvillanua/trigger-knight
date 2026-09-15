import { describe, expect, it, vi } from "vitest";

import type {
  PresentationFrame,
  PresentationPort,
  PresentationTransition,
  RunConfig,
} from "../../src/application/contracts.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "browser-session-seed",
  initialProfile: Object.freeze({
    schemaVersion: 1,
    scoreMultiplier: 1,
    tutorialPreference: "disabled" as const,
  }),
});

const initialPlayer = {
  gold: 300,
  weapon: { tier: 1, name: "Dagger", attack: 216 },
  armor: { tier: 1, name: "Clothing" },
  hp: { current: 1_908, maximum: 1_908 },
  inventory: { item: "elixir" },
} as const;

const diagnosticOptions = Object.freeze({ retainDiagnostics: true });

describe("browser gameplay session", () => {
  it("produces the same public result with replaced or disabled presentation", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const presentation: PresentationPort = { present };
    const presented = createBrowserGameplaySession(
      gameplayEngine,
      config,
      presentation,
      diagnosticOptions,
    );
    const unpresented = createBrowserGameplaySession(
      gameplayEngine,
      config,
      undefined,
      diagnosticOptions,
    );
    const commands = Object.freeze([]);

    const presentedResult = presented.dispatch(commands);
    const unpresentedResult = unpresented.dispatch(commands);

    expect(presentedResult).toEqual(unpresentedResult);
    expect(presented.readDiagnostics()).toEqual(unpresented.readDiagnostics());
    expect(presentedResult).toMatchObject({
      observation: {
        ruleset: ORIGINAL_V13_RULESET_ID,
        camera: {
          x: 0,
          y: 0,
          width: 480,
          height: 320,
        },
        steps: 1,
        activeTicks: 0,
        movementSpeed: 0,
        distance: 0,
        day: 1,
        score: 0,
        lifespan: {
          whole: 99,
          fraction: 99,
        },
        player: initialPlayer,
        encounters: {
          current: null,
          upcoming: presentedResult.observation.encounters.upcoming,
        },
        lifecycle: {
          phase: "running",
          terminalReason: null,
          paused: false,
          tutorialPage: 0,
          pregameStepsRemaining: 60,
          activeGameplay: false,
        },
        actions: {
          canTogglePause: true,
          canDismissTutorial: true,
          canPurchaseCurrentEncounter: false,
          canUseCarriedItem: false,
        },
      },
      events: [{ type: "step-advanced", step: 1 }],
    });
    expect(present).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenLastCalledWith({
      previous: presented.readDiagnostics().checkpoints[0]?.observation,
      current: presentedResult.observation,
      interpolation: 0,
      events: [{ type: "step-advanced", step: 1 }],
    });
  });

  it("re-presents one transition at different interpolation values without stepping", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const session = createBrowserGameplaySession(
      gameplayEngine,
      config,
      {
        present,
      },
      diagnosticOptions,
    );
    session.dispatch([]);
    const traceBeforePresentation = session.readDiagnostics();

    session.render(0.5);
    session.render(1);

    expect(session.readDiagnostics()).toEqual(traceBeforePresentation);
    expect(present.mock.calls.map(([frame]) => frame.interpolation)).toEqual([
      1, 0, 0.5, 1,
    ]);
    expect(
      present.mock.calls.slice(-3).map(([frame]) => ({
        interpolation: frame.interpolation,
        previous: frame.previous,
        current: frame.current,
        events: frame.events,
      })),
    ).toEqual(
      [0, 0.5, 1].map((interpolation) => ({
        interpolation,
        previous: traceBeforePresentation.checkpoints[0]?.observation,
        current: traceBeforePresentation.checkpoints[1]?.observation,
        events: traceBeforePresentation.checkpoints[1]?.events,
      })),
    );
  });

  it("keeps ordered public events from logical steps between renders", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const session = createBrowserGameplaySession(
      gameplayEngine,
      config,
      { present },
      { renderOnDispatch: false, retainDiagnostics: true },
    );

    session.dispatch([{ type: "dismiss-tutorial" }]);
    session.dispatch([]);
    session.render(0.5);

    expect(present.mock.calls.at(-1)?.[0].events).toEqual([
      { type: "tutorial-dismissed", page: 0 },
      { type: "step-advanced", step: 1 },
      { type: "step-advanced", step: 2 },
    ]);
    expect(session.readDiagnostics().checkpoints).toHaveLength(3);

    session.render(1);

    expect(present.mock.calls.at(-1)?.[0].events).toEqual([
      { type: "tutorial-dismissed", page: 0 },
      { type: "step-advanced", step: 1 },
      { type: "step-advanced", step: 2 },
    ]);
    expect(session.readDiagnostics().checkpoints).toHaveLength(3);
  });

  it("notifies presentation of each public transition before a batched render", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const presentTransition =
      vi.fn<(transition: PresentationTransition) => void>();
    const session = createBrowserGameplaySession(
      gameplayEngine,
      config,
      { present, presentTransition },
      { renderOnDispatch: false, retainDiagnostics: true },
    );

    session.dispatch([{ type: "dismiss-tutorial" }]);
    session.dispatch([]);

    expect(presentTransition).toHaveBeenCalledTimes(2);
    expect(
      presentTransition.mock.calls.map(([transition]) => ({
        previous: transition.previous.steps,
        current: transition.current.steps,
        events: transition.events,
      })),
    ).toEqual([
      {
        previous: 0,
        current: 1,
        events: [
          { type: "tutorial-dismissed", page: 0 },
          { type: "step-advanced", step: 1 },
        ],
      },
      {
        previous: 1,
        current: 2,
        events: [{ type: "step-advanced", step: 2 }],
      },
    ]);
    expect(present).toHaveBeenCalledTimes(1);
  });

  it("keeps the committed lifespan death trace fixed during later presentation", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const session = createBrowserGameplaySession(
      gameplayEngine,
      { ...config, seed: "milestone-2-lifecycle-2" },
      {
        present,
      },
      diagnosticOptions,
    );
    session.dispatch([{ type: "dismiss-tutorial" }]);
    for (let step = 1; step < 2_560; step += 1) {
      session.dispatch([]);
    }
    const terminalTrace = session.readDiagnostics();

    expect(terminalTrace.checkpoints.at(-1)).toMatchObject({
      state: {
        steps: 2_560,
        activeTicks: 2_500,
        lifecycle: { phase: "ended", terminalReason: "lifespan" },
      },
      events: [
        { type: "step-advanced", step: 2_560 },
        { type: "lifespan-death" },
        { type: "run-ended", reason: "lifespan" },
      ],
    });

    session.render(0);
    session.render(0.5);
    session.render(1);

    expect(session.readDiagnostics()).toEqual(terminalTrace);
    expect(
      present.mock.calls.slice(-3).map(([frame]) => ({
        interpolation: frame.interpolation,
        current: frame.current,
        events: frame.events,
      })),
    ).toEqual(
      [0, 0.5, 1].map((interpolation) => ({
        interpolation,
        current: terminalTrace.checkpoints.at(-1)?.observation,
        events: terminalTrace.checkpoints.at(-1)?.events,
      })),
    );
  });
});
