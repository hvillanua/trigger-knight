import {
  gameplayEngine,
  WALKING_SKELETON_RULESET_ID,
} from "./application/gameplay-engine.js";
import { CanvasPresentation } from "./browser/canvas-presentation.js";
import { observeDevicePixelRatioChanges } from "./browser/device-pixel-ratio.js";
import type { CssDimensions } from "./browser/foundation.js";
import { createBrowserGameplaySession } from "./browser/gameplay-session.js";
import { commandsForAdvanceActivation } from "./browser/input.js";
import "./browser/style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const advanceButton = document.querySelector<HTMLButtonElement>("#advance-run");
const gameStatus = document.querySelector<HTMLElement>("#game-status");

if (canvas === null) {
  throw new Error("Missing #game-canvas");
}

if (advanceButton === null || gameStatus === null) {
  throw new Error("Missing browser gameplay controls");
}

const presentation = new CanvasPresentation(canvas);
const session = createBrowserGameplaySession(
  gameplayEngine,
  Object.freeze({
    ruleset: WALKING_SKELETON_RULESET_ID,
    seed: "browser-run",
    initialProfile: Object.freeze({ schemaVersion: 1 }),
  }),
  presentation,
  { retainDiagnostics: import.meta.env.DEV },
);

if (import.meta.env.DEV) {
  window.triggerKnightDiagnostics = Object.freeze({
    read: () => session.readDiagnostics(),
  });
}

let contentBox: CssDimensions | undefined;

const render = (): void => {
  if (contentBox === undefined) {
    return;
  }

  presentation.resize(contentBox, window.devicePixelRatio);
};

advanceButton.addEventListener("click", () => {
  const result = session.dispatch(commandsForAdvanceActivation());
  gameStatus.textContent = `Step ${result.observation.steps}`;
});

observeDevicePixelRatioChanges(window, render);
window.addEventListener("resize", render);

const resizeObserver = new ResizeObserver(([entry]) => {
  if (entry === undefined) {
    return;
  }

  contentBox = {
    width: entry.contentRect.width,
    height: entry.contentRect.height,
  };
  render();
});
resizeObserver.observe(canvas);
