import { createFreshProfile } from "./domain/profile.js";
import { createCompletedRunCoordinator } from "./application/completed-run.js";
import { createGameplayEngine } from "./application/gameplay-engine.js";
import { CanvasPresentation } from "./browser/canvas-presentation.js";
import { observeDevicePixelRatioChanges } from "./browser/device-pixel-ratio.js";
import type {
  GameCommand,
  ProfileLoadResult,
} from "./application/contracts.js";
import type { CssDimensions } from "./browser/foundation.js";
import { createBrowserGameplaySession } from "./browser/gameplay-session.js";
import {
  commandsForAdvanceActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
} from "./browser/input.js";
import { ORIGINAL_V13_RULESET_ID, ruleSetRegistry } from "./domain/rulesets.js";
import { createBrowserProfileStore } from "./persistence/browser-profile-store.js";
import "./browser/style.css";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const advanceButton = document.querySelector<HTMLButtonElement>("#advance-run");
const purchaseButton = document.querySelector<HTMLButtonElement>(
  "#purchase-current-encounter",
);
const useItemButton =
  document.querySelector<HTMLButtonElement>("#use-carried-item");
const gameStatus = document.querySelector<HTMLElement>("#game-status");

if (canvas === null) {
  throw new Error("Missing #game-canvas");
}

if (
  advanceButton === null ||
  purchaseButton === null ||
  useItemButton === null ||
  gameStatus === null
) {
  throw new Error("Missing browser gameplay controls");
}

const profileStore = createBrowserProfileStore(window.localStorage);
let profileLoad: ProfileLoadResult;
try {
  profileLoad = profileStore.load();
} catch {
  profileLoad = {
    status: "failed",
    error: {
      code: "storage-read-failed",
      message: "Profile storage could not be opened",
    },
  };
}
const initialProfile =
  profileLoad.status === "failed" ? createFreshProfile() : profileLoad.profile;
const completedRunCoordinator = createCompletedRunCoordinator(profileStore);
const completionId = window.crypto.randomUUID();
gameStatus.dataset.persistenceStatus = profileLoad.status;
if (profileLoad.status === "failed") {
  gameStatus.dataset.persistenceError = profileLoad.error.code;
}

const presentation = new CanvasPresentation(canvas);
const session = createBrowserGameplaySession(
  gameplayEngine,
  Object.freeze({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "browser-run",
    initialProfile,
  }),
  presentation,
  {
    retainDiagnostics: import.meta.env.DEV,
    onCompletedRun: (run) => {
      const result = completedRunCoordinator.commit({
        completionId,
        initialProfile,
        run,
      });
      gameStatus.dataset.completionStatus = result.status;
      if (result.status === "failed" || result.status === "uncertain") {
        gameStatus.dataset.completionError = result.error.code;
      } else {
        delete gameStatus.dataset.completionError;
      }
    },
  },
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

const dispatch = (commands: readonly GameCommand[]): void => {
  const result = session.dispatch(commands);
  session.render(1);
  gameStatus.textContent = `Step ${result.observation.steps}`;
  purchaseButton.disabled =
    !result.observation.actions.canPurchaseCurrentEncounter;
  useItemButton.disabled = !result.observation.actions.canUseCarriedItem;
};

advanceButton.addEventListener("click", () => {
  dispatch(commandsForAdvanceActivation());
});

purchaseButton.addEventListener("click", () => {
  dispatch(commandsForPurchaseActivation());
});

useItemButton.addEventListener("click", () => {
  dispatch(commandsForItemUseActivation());
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
