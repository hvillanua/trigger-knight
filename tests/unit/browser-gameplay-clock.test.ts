import { describe, expect, it, vi } from "vitest";
import type {
  GameCommand,
  PresentationFrame,
  RunConfig,
} from "../../src/application/contracts.js";
import { createGameplayExecution } from "../../src/application/gameplay-execution.js";
import { createBrowserGameplayClock } from "../../src/browser/gameplay-clock.js";
import {
  createBrowserGameplaySession,
  type BrowserDispatchResult,
} from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();
const config: RunConfig = {
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "milestone-2-lifecycle-2",
  initialProfile: {
    schemaVersion: 1,
    scoreMultiplier: 1,
    tutorialPreference: "disabled",
  },
};
const dismiss: readonly GameCommand[] = [{ type: "dismiss-tutorial" }];

function setup() {
  let nextId = 0;
  const callbacks = new Map<number, (time: number) => void>();
  const present = vi.fn<(frame: PresentationFrame) => void>();
  const onTransition = vi.fn<(result: BrowserDispatchResult) => void>();
  const onCompletedRun = vi.fn();
  const session = createBrowserGameplaySession(
    engine,
    config,
    { present },
    {
      renderOnDispatch: false,
      onTransition,
      onCompletedRun,
    },
  );
  const clock = createBrowserGameplayClock(session, {
    requestFrame: (callback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    },
    cancelFrame: (id) => {
      callbacks.delete(id);
    },
  });
  const frame = (time: number) => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback(time));
  };
  return {
    clock,
    session,
    present,
    onTransition,
    onCompletedRun,
    callbacks,
    frame,
  };
}

describe("browser fixed clock", () => {
  it.each([15, 30, 60, 144])(
    "matches every headless checkpoint at %i Hz",
    (hz) => {
      const { clock, session, frame, present, onTransition } = setup();
      const headless = createGameplayExecution(engine, config);
      clock.start();
      frame(0);
      clock.enqueue(dismiss);
      for (let index = 1; index <= hz * 3; index += 1)
        frame((index * 1000) / hz);
      for (let step = 0; step < 90; step += 1)
        headless.dispatch(step === 0 ? dismiss : []);
      expect(session.readDiagnostics()).toEqual(headless.readDiagnostics());
      expect(onTransition).toHaveBeenCalledTimes(90);
      expect(onTransition.mock.calls.map(([result]) => result)).toEqual(
        headless
          .readDiagnostics()
          .checkpoints.slice(1)
          .map(({ observation, events }) => ({ observation, events })),
      );
      expect(present).toHaveBeenCalledTimes(hz * 3 + 2);
      expect(present.mock.calls.at(-1)?.[0].interpolation).toBeCloseTo(0);
    },
  );

  it("queues ordered device commands without adding steps and processes resume through gates", () => {
    const { clock, session, frame } = setup();
    clock.start();
    frame(0);
    clock.enqueue(dismiss);
    clock.enqueue([{ type: "toggle-pause" }]);
    expect(session.readDiagnostics().checkpoints).toHaveLength(1);
    frame(100);
    expect(
      session.readDiagnostics().checkpoints.at(-1)?.observation.lifecycle
        .paused,
    ).toBe(true);
    expect(session.readDiagnostics().checkpoints[1]?.commands).toEqual([
      ...dismiss,
      { type: "toggle-pause" },
    ]);
    clock.enqueue([{ type: "toggle-pause" }]);
    frame(200);
    expect(
      session.readDiagnostics().checkpoints.at(-1)?.observation.lifecycle
        .paused,
    ).toBe(false);
    expect(
      session.readDiagnostics().checkpoints.at(-1)?.observation.steps,
    ).toBe(6);
  });

  it("drops hidden time and stale commands, resets long gaps, and rejects obsolete callbacks", () => {
    const { clock, session, frame, callbacks } = setup();
    clock.start();
    frame(0);
    frame(20);
    clock.enqueue(dismiss);
    const stale = [...callbacks.values()][0]!;
    clock.setVisible(false);
    expect(callbacks.size).toBe(0);
    clock.enqueue(dismiss);
    clock.setVisible(true);
    stale(1000);
    frame(1000);
    frame(1020);
    expect(session.readDiagnostics().checkpoints).toHaveLength(1);
    frame(1040);
    expect(session.readDiagnostics().checkpoints[1]?.commands).toEqual([]);
    clock.enqueue(dismiss);
    frame(5000);
    frame(5020);
    expect(session.readDiagnostics().checkpoints).toHaveLength(2);
    frame(5040);
    expect(session.readDiagnostics().checkpoints[2]?.commands).toEqual([]);
    clock.enqueue(dismiss);
    const stopped = [...callbacks.values()][0]!;
    clock.stop();
    clock.start();
    stopped(5100);
    frame(6000);
    frame(6040);
    expect(session.readDiagnostics().checkpoints[3]?.commands).toEqual([]);
  });

  it("holds the current observation after resumption until a new transition", () => {
    const { clock, frame, present } = setup();
    clock.start();
    frame(0);
    clock.enqueue(dismiss);
    frame(100);
    frame(1000);
    frame(1010);
    expect(present.mock.calls.at(-1)?.[0].interpolation).toBe(1);
    frame(1040);
    expect(present.mock.calls.at(-1)?.[0].interpolation).toBeCloseTo(0.2);
    clock.setVisible(false);
    clock.setVisible(true);
    frame(2000);
    frame(2010);
    expect(present.mock.calls.at(-1)?.[0].interpolation).toBe(1);
  });

  it("keeps tutorial and pause gates frozen while logical opportunities continue", () => {
    const { clock, session, frame } = setup();
    const latest = () =>
      session.readDiagnostics().checkpoints.at(-1)!.observation;
    clock.start();
    frame(0);
    for (let time = 100; time <= 3000; time += 100) frame(time);
    expect(latest().activeTicks).toBe(0);
    clock.enqueue(dismiss);
    for (let time = 3100; time <= 6000; time += 100) frame(time);
    expect(latest().activeTicks).toBeGreaterThan(0);
    clock.enqueue([{ type: "toggle-pause" }]);
    frame(6100);
    const paused = latest();
    for (let time = 6200; time <= 7000; time += 100) frame(time);
    expect(latest().activeTicks).toBe(paused.activeTicks);
    expect(latest().steps).toBeGreaterThan(paused.steps);
    clock.enqueue([{ type: "toggle-pause" }]);
    frame(7100);
    expect(latest().activeTicks).toBeGreaterThan(paused.activeTicks);
  });

  it("commits termination once, presents it fully, and stops scheduling", () => {
    const {
      clock,
      session,
      frame,
      callbacks,
      onCompletedRun,
      present,
      onTransition,
    } = setup();
    clock.start();
    frame(0);
    clock.enqueue(dismiss);
    for (let time = 100; time <= 86000; time += 100) frame(time);
    expect(session.readDiagnostics().checkpoints).toHaveLength(2561);
    expect(onCompletedRun).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledTimes(2560);
    expect(present.mock.calls.at(-1)?.[0]).toMatchObject({
      interpolation: 1,
      current: { lifecycle: { phase: "ended" } },
    });
    expect(onCompletedRun.mock.invocationCallOrder[0]).toBeLessThan(
      onTransition.mock.invocationCallOrder.at(-1)!,
    );
    expect(onTransition.mock.invocationCallOrder.at(-1)).toBeLessThan(
      present.mock.invocationCallOrder.at(-1)!,
    );
    expect(callbacks.size).toBe(0);
    clock.enqueue(dismiss);
    clock.start();
    frame(87000);
    expect(session.readDiagnostics().checkpoints).toHaveLength(2561);
  });
});
