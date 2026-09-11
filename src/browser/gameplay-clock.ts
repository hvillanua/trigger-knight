import type { GameCommand } from "../application/contracts.js";
import type { BrowserGameplaySession } from "./gameplay-session.js";

const STEP_MS = 1000 / 30;
const MAX_FRAME_GAP_MS = 250;
const ROUNDING_EPSILON_MS = 1e-7;

export interface AnimationFrameHost {
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
}

export interface BrowserGameplayClock {
  start(): void;
  stop(): void;
  setVisible(visible: boolean): void;
  enqueue(commands: readonly GameCommand[]): void;
}

/** Browser timing policy; the session remains the sole owner of gameplay. */
export function createBrowserGameplayClock(
  session: Pick<BrowserGameplaySession, "dispatch" | "render">,
  host: AnimationFrameHost,
): BrowserGameplayClock {
  let running = false;
  let visible = true;
  let ended = false;
  let generation = 0;
  let request: number | undefined;
  let previousTime: number | undefined;
  let accumulated = 0;
  let canInterpolate = false;
  let commands: GameCommand[] = [];

  const reset = (): void => {
    generation += 1;
    if (request !== undefined) host.cancelFrame(request);
    request = undefined;
    previousTime = undefined;
    accumulated = 0;
    canInterpolate = false;
    commands = [];
  };

  const schedule = (): void => {
    if (!running || !visible || ended || request !== undefined) return;
    const scheduledGeneration = generation;
    request = host.requestFrame((time) => {
      if (generation !== scheduledGeneration) return;
      request = undefined;
      const elapsed = previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      if (!Number.isFinite(time) || elapsed < 0 || elapsed > MAX_FRAME_GAP_MS) {
        reset();
        previousTime = Number.isFinite(time) ? time : undefined;
        session.render(1);
      } else {
        accumulated += elapsed;
        while (accumulated + ROUNDING_EPSILON_MS >= STEP_MS) {
          accumulated = Math.max(0, accumulated - STEP_MS);
          const scheduledCommands = commands;
          commands = [];
          const result = session.dispatch(scheduledCommands);
          canInterpolate = true;
          // A completion callback may replace or stop this session.
          if (generation !== scheduledGeneration) return;
          if (result.observation.lifecycle.phase === "ended") {
            ended = true;
            running = false;
            reset();
            break;
          }
        }
        session.render(ended || !canInterpolate ? 1 : accumulated / STEP_MS);
      }
      schedule();
    });
  };

  return Object.freeze({
    start(): void {
      if (running || ended) return;
      running = true;
      reset();
      schedule();
    },
    stop(): void {
      running = false;
      reset();
    },
    setVisible(nextVisible: boolean): void {
      if (visible === nextVisible) return;
      visible = nextVisible;
      reset();
      schedule();
    },
    enqueue(nextCommands: readonly GameCommand[]): void {
      if (!running || !visible || ended) return;
      // All activations before the next opportunity share that step, in order.
      commands.push(
        ...nextCommands.map((command) => Object.freeze({ ...command })),
      );
    },
  });
}
