import {
  createCompletedRunCoordinator,
  type CompletedRunResult,
} from "./application/completed-run.js";
import type {
  CompletedRunSettlementInput,
  GameCommand,
  GameObservation,
  ProfileLoadResult,
  ProfileState,
  ProfileStore,
} from "./application/contracts.js";
import { createGameplayEngine } from "./application/gameplay-engine.js";
import {
  createFreshProfile,
  calculateProfileProgress,
} from "./domain/profile.js";
import { CanvasPresentation } from "./browser/canvas-presentation.js";
import { observeDevicePixelRatioChanges } from "./browser/device-pixel-ratio.js";
import type { CssDimensions } from "./browser/foundation.js";
import {
  CompletedRunPresentation,
  type PendingCompletedRunView,
} from "./browser/completed-run-presentation.js";
import {
  createBrowserGameplaySession,
  type BrowserGameplaySession,
} from "./browser/gameplay-session.js";
import {
  commandsForAdvanceActivation,
  commandsForDismissTutorialActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
} from "./browser/input.js";
import { ORIGINAL_V13_RULESET_ID, ruleSetRegistry } from "./domain/rulesets.js";
import { createBrowserProfileStore } from "./persistence/browser-profile-store.js";
import "./browser/style.css";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing browser element ${selector}`);
  }
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const dismissTutorialButton =
  requiredElement<HTMLButtonElement>("#dismiss-tutorial");
const advanceButton = requiredElement<HTMLButtonElement>("#advance-run");
const purchaseButton = requiredElement<HTMLButtonElement>(
  "#purchase-current-encounter",
);
const useItemButton = requiredElement<HTMLButtonElement>("#use-carried-item");
const gameStatus = requiredElement<HTMLElement>("#game-status");
const profileSummary = requiredElement<HTMLElement>("#profile-summary");
const resultRoot = requiredElement<HTMLElement>("#run-result");

const storageUnavailableError = Object.freeze({
  code: "storage-read-failed" as const,
  message: "Profile storage could not be opened",
});
const unavailableProfileStore: ProfileStore = Object.freeze({
  load: () =>
    Object.freeze({
      status: "failed" as const,
      error: storageUnavailableError,
    }),
  save: () =>
    Object.freeze({
      status: "failed" as const,
      error: storageUnavailableError,
    }),
  commitCompletedRun: () =>
    Object.freeze({
      status: "failed" as const,
      error: storageUnavailableError,
    }),
});

let profileStore: ProfileStore = unavailableProfileStore;
let profileLoad: ProfileLoadResult;
try {
  profileStore = createBrowserProfileStore(window.localStorage);
  profileLoad = profileStore.load();
} catch {
  profileLoad = unavailableProfileStore.load();
}

const completedRunCoordinator = createCompletedRunCoordinator(profileStore);
const presentation = new CanvasPresentation(canvas);
let runNumber = 0;

interface ActiveRun {
  readonly completionId: string;
  readonly initialProfile: ProfileState;
  session: BrowserGameplaySession | undefined;
  settlement: Readonly<CompletedRunSettlementInput> | undefined;
  commit: CompletedRunResult | undefined;
}

let activeRun: ActiveRun | undefined;

function updateProfileSummary(profile: Readonly<ProfileState>): void {
  const progress = calculateProfileProgress(profile);
  profileSummary.textContent =
    `Level ${profile.level} · XP ${profile.xp} · ` +
    `Multiplier ${profile.scoreMultiplier} · High score ${profile.highScore} · ` +
    `Collections ${progress.weaponCount + progress.armorCount}/20 · ` +
    `Achievements ${progress.achievementsUnlocked}/5`;
}

function pendingView(
  run: Readonly<CompletedRunSettlementInput>,
): PendingCompletedRunView {
  const terminalReason = run.lifecycle.terminalReason;
  if (terminalReason !== "lifespan" && terminalReason !== "combat") {
    throw new TypeError("Pending result requires a gameplay death");
  }
  return Object.freeze({
    terminalReason,
    score: run.score,
    profileExpEarned: run.profileExpEarned,
  });
}

function renderCompletion(record: ActiveRun): void {
  const settlement = record.settlement;
  const commit = record.commit;
  if (settlement === undefined || commit === undefined) {
    return;
  }

  gameStatus.dataset.completionStatus = commit.status;
  if (commit.status === "failed" || commit.status === "uncertain") {
    gameStatus.dataset.completionError = commit.error.code;
    resultPresentation.showPending(
      pendingView(settlement),
      commit.status,
      commit.error.code,
    );
    return;
  }

  delete gameStatus.dataset.completionError;
  resultPresentation.showCommitted(commit.result, commit.status);
}

function commitCompletedRun(record: ActiveRun): void {
  if (record.settlement === undefined) {
    return;
  }

  record.commit = completedRunCoordinator.commit({
    completionId: record.completionId,
    initialProfile: record.initialProfile,
    run: record.settlement,
  });
  renderCompletion(record);
}

const resultPresentation = new CompletedRunPresentation(resultRoot, {
  onRetry: () => {
    if (activeRun?.settlement !== undefined) {
      commitCompletedRun(activeRun);
    }
  },
  onNextRun: () => {
    const commit = activeRun?.commit;
    if (
      commit !== undefined &&
      (commit.status === "committed" || commit.status === "already-committed")
    ) {
      startRun(commit.profile);
    }
  },
});

gameStatus.dataset.persistenceStatus = profileLoad.status;
if (profileLoad.status === "failed") {
  gameStatus.dataset.persistenceError = profileLoad.error.code;
}

function syncControls(observation: Readonly<GameObservation>): void {
  const ended = observation.lifecycle.phase === "ended";
  dismissTutorialButton.disabled =
    ended || !observation.actions.canDismissTutorial;
  advanceButton.disabled = ended;
  purchaseButton.disabled =
    ended || !observation.actions.canPurchaseCurrentEncounter;
  useItemButton.disabled = ended || !observation.actions.canUseCarriedItem;
}

function startRun(profile: ProfileState): void {
  runNumber += 1;
  const record: ActiveRun = {
    completionId: window.crypto.randomUUID(),
    initialProfile: profile,
    session: undefined,
    settlement: undefined,
    commit: undefined,
  };
  activeRun = record;
  resultPresentation.reset();
  updateProfileSummary(profile);
  delete gameStatus.dataset.completionStatus;
  delete gameStatus.dataset.completionError;
  gameStatus.textContent = "Step 0";
  dismissTutorialButton.disabled = false;
  advanceButton.disabled = false;
  purchaseButton.disabled = true;
  useItemButton.disabled = true;

  record.session = createBrowserGameplaySession(
    gameplayEngine,
    Object.freeze({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: runNumber === 1 ? "browser-run" : `browser-run-${runNumber}`,
      initialProfile: profile,
    }),
    presentation,
    {
      retainDiagnostics: import.meta.env.DEV,
      onCompletedRun: (run) => {
        record.settlement = run;
        commitCompletedRun(record);
      },
    },
  );
}

if (import.meta.env.DEV) {
  window.triggerKnightDiagnostics = Object.freeze({
    read: () => {
      const session = activeRun?.session;
      if (session === undefined) {
        throw new Error("No active browser gameplay session");
      }
      return session.readDiagnostics();
    },
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
  const session = activeRun?.session;
  if (session === undefined) {
    return;
  }

  const result = session.dispatch(commands);
  session.render(1);
  gameStatus.textContent = `Step ${result.observation.steps}`;
  syncControls(result.observation);
};

dismissTutorialButton.addEventListener("click", () => {
  dispatch(commandsForDismissTutorialActivation());
});

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

startRun(
  profileLoad.status === "failed" ? createFreshProfile() : profileLoad.profile,
);
