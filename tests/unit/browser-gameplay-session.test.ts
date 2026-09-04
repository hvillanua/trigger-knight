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
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

const initialPlayer = {
  gold: 300,
  weapon: { tier: 1, name: "Dagger", attack: 216 },
  armor: { tier: 1, name: "Clothing" },
  hp: { current: 1_908, maximum: 1_908 },
  inventory: { item: "elixir" },
} as const;

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
    const session = createBrowserGameplaySession(gameplayEngine, config, {
      present,
    });
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

  it("keeps the committed lifespan death trace fixed during later presentation", () => {
    const present = vi.fn<(frame: PresentationFrame) => void>();
    const session = createBrowserGameplaySession(gameplayEngine, config, {
      present,
    });
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
