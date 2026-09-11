import {
  createCompletedRunCoordinator,
  type CompletedRunResult,
} from "./application/completed-run.js";
import {
  createProfileOverviewView,
  type ProfileOverviewView,
} from "./application/profile.js";
import type {
  BrowserSettings,
  SettingsLoadResult,
  SettingsStore,
} from "./application/settings.js";
import {
  createDefaultSettings,
  normalizeSettings,
  SETTINGS_SCHEMA_VERSION,
} from "./application/settings.js";
import type {
  CompletedRunSettlementInput,
  GameCommand,
  GameObservation,
  ProfileLoadResult,
  ProfileState,
  ProfileStore,
  TutorialPage,
} from "./application/contracts.js";
import { createGameplayEngine } from "./application/gameplay-engine.js";
import { CanvasPresentation } from "./browser/canvas-presentation.js";
import {
  CompletedRunPresentation,
  type PendingCompletedRunView,
} from "./browser/completed-run-presentation.js";
import {
  createBrowserGameplayClock,
  type BrowserGameplayClock,
} from "./browser/gameplay-clock.js";
import { observeDevicePixelRatioChanges } from "./browser/device-pixel-ratio.js";
import type { CssDimensions } from "./browser/foundation.js";
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
import { createFreshProfile } from "./domain/profile.js";
import { ORIGINAL_V13_RULESET_ID, ruleSetRegistry } from "./domain/rulesets.js";
import { createBrowserProfileStore } from "./persistence/browser-profile-store.js";
import { createBrowserSettingsStore } from "./persistence/browser-settings-store.js";
import "./browser/style.css";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing browser element ${selector}`);
  }
  return element;
}

const titleScreen = requiredElement<HTMLElement>("#title-screen");
const gameplayScreen = requiredElement<HTMLElement>("#gameplay-screen");
const collectionsScreen = requiredElement<HTMLElement>("#collections-screen");
const achievementsScreen = requiredElement<HTMLElement>("#achievements-screen");
const settingsScreen = requiredElement<HTMLElement>("#settings-screen");
const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const dismissTutorialButton =
  requiredElement<HTMLButtonElement>("#dismiss-tutorial");
const manualClock =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("manual") === "1";
const advanceButton = manualClock
  ? document.createElement("button")
  : undefined;
const gameplayControls = requiredElement<HTMLElement>(".gameplay-controls");
if (advanceButton !== undefined) {
  advanceButton.id = "advance-run";
  advanceButton.type = "button";
  advanceButton.textContent = "Advance run";
  gameplayControls.prepend(advanceButton);
}
const pauseButton = requiredElement<HTMLButtonElement>("#toggle-pause");
const purchaseButton = requiredElement<HTMLButtonElement>(
  "#purchase-current-encounter",
);
const useItemButton = requiredElement<HTMLButtonElement>("#use-carried-item");
const gameStatus = requiredElement<HTMLElement>("#game-status");
const profileSummary = requiredElement<HTMLElement>("#profile-summary");
const titleProfileSummary = requiredElement<HTMLElement>(
  "#title-profile-summary",
);
const storageNotice = requiredElement<HTMLElement>("#storage-notice");
const resultRoot = requiredElement<HTMLElement>("#run-result");
const tutorialPanel = requiredElement<HTMLElement>("#tutorial-panel");
const tutorialPageLabel = requiredElement<HTMLElement>("#tutorial-page-label");
const tutorialHeading = requiredElement<HTMLElement>("#tutorial-heading");
const tutorialCopy = requiredElement<HTMLElement>("#tutorial-copy");
const pausePanel = requiredElement<HTMLElement>("#pause-panel");
const weaponCollection =
  requiredElement<HTMLUListElement>("#weapon-collection");
const armorCollection = requiredElement<HTMLUListElement>("#armor-collection");
const collectionProgress = requiredElement<HTMLElement>(
  "#collections-progress",
);
const achievementList = requiredElement<HTMLUListElement>("#achievement-list");
const achievementProgress = requiredElement<HTMLElement>(
  "#achievements-progress",
);
const settingsStatus = requiredElement<HTMLElement>("#settings-status");
const settingsForm = requiredElement<HTMLFormElement>("#settings-form");
const tutorialPreference = requiredElement<HTMLInputElement>(
  "#tutorial-preference",
);
const soundMuted = requiredElement<HTMLInputElement>("#sound-muted");
const soundVolume = requiredElement<HTMLInputElement>("#sound-volume");
const soundVolumeValue = requiredElement<HTMLOutputElement>(
  "#sound-volume-value",
);
const bindingTogglePause = requiredElement<HTMLInputElement>(
  "#binding-toggle-pause",
);
const bindingDismissTutorial = requiredElement<HTMLInputElement>(
  "#binding-dismiss-tutorial",
);
const bindingPurchase = requiredElement<HTMLInputElement>("#binding-purchase");
const bindingUseItem = requiredElement<HTMLInputElement>("#binding-use-item");
const resultCollections = requiredElement<HTMLButtonElement>(
  "#result-view-collections",
);
const resultAchievements = requiredElement<HTMLButtonElement>(
  "#result-view-achievements",
);
const resultMainMenu = requiredElement<HTMLButtonElement>("#result-main-menu");

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
const settingsUnavailableError = Object.freeze({
  code: "storage-read-failed" as const,
  message: "Browser settings storage could not be opened",
});
const unavailableSettingsStore: SettingsStore = Object.freeze({
  load: () =>
    Object.freeze({
      status: "failed" as const,
      error: settingsUnavailableError,
    }),
  save: () =>
    Object.freeze({
      status: "failed" as const,
      error: settingsUnavailableError,
    }),
});

let profileStore: ProfileStore = unavailableProfileStore;
let profileLoad: ProfileLoadResult;
let settingsStore: SettingsStore = unavailableSettingsStore;
let settingsLoad: SettingsLoadResult;
try {
  const storage = window.localStorage;
  profileStore = createBrowserProfileStore(storage);
  profileLoad = profileStore.load();
  settingsStore = createBrowserSettingsStore(storage);
  settingsLoad = settingsStore.load();
} catch {
  profileLoad = unavailableProfileStore.load();
  settingsLoad = unavailableSettingsStore.load();
}

let currentProfile: ProfileState =
  profileLoad.status === "failed" ? createFreshProfile() : profileLoad.profile;
let currentSettings: BrowserSettings =
  settingsLoad.status === "failed"
    ? createDefaultSettings()
    : settingsLoad.settings;

const completedRunCoordinator = createCompletedRunCoordinator(profileStore);
const presentation = new CanvasPresentation(canvas);
let runNumber = 0;

type ScreenId =
  "title" | "gameplay" | "result" | "collections" | "achievements" | "settings";

const screens: Readonly<Record<ScreenId, HTMLElement>> = Object.freeze({
  title: titleScreen,
  gameplay: gameplayScreen,
  result: resultRoot,
  collections: collectionsScreen,
  achievements: achievementsScreen,
  settings: settingsScreen,
});
let currentScreen: ScreenId = "gameplay";
let profileReturnScreen: "title" | "result" = "title";
let settingsReturnScreen: "title" | "result" = "title";

function showScreen(screen: ScreenId, focus = true): void {
  for (const [id, element] of Object.entries(screens) as [
    ScreenId,
    HTMLElement,
  ][]) {
    element.hidden = id !== screen;
  }
  currentScreen = screen;
  if (focus) {
    screens[screen].focus();
  }
}

function profileSummaryText(view: ProfileOverviewView): string {
  return (
    `Level ${view.level} · XP ${view.xp} · ` +
    `Multiplier ${view.scoreMultiplier} · High score ${view.highScore} · ` +
    `Collections ${view.collections.totalDiscovered}/${view.collections.total} · ` +
    `Achievements ${view.achievements.filter(({ unlocked }) => unlocked).length}/5`
  );
}

function updateProfileSummary(profile: Readonly<ProfileState>): void {
  const view = createProfileOverviewView(profile);
  const summary = profileSummaryText(view);
  profileSummary.textContent = summary;
  titleProfileSummary.textContent = summary;
}

function achievementLabel(
  id: ProfileOverviewView["achievements"][number]["id"],
): string {
  switch (id) {
    case "slay-a-dragon":
      return "Slay a dragon";
    case "stashed-3000-gold":
      return "Stash 3,000 gold";
    case "reach-day-10":
      return "Reach day 10";
    case "get-all-collection":
      return "Complete the collection";
    case "perform-70000-damage":
      return "Deal 70,000 damage";
  }
}

function renderEquipmentList(
  list: HTMLUListElement,
  entries: ProfileOverviewView["collections"]["weapons"],
): void {
  list.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement("li");
      const state = entry.discovered ? "Discovered" : "Not discovered";
      item.dataset.tier = String(entry.tier);
      item.dataset.discovered = String(entry.discovered);
      item.setAttribute(
        "aria-label",
        `Tier ${entry.tier}, ${entry.name}, ${state}`,
      );
      item.textContent = `Tier ${entry.tier}: ${entry.name} · ${state}`;
      return item;
    }),
  );
}

function renderProfileScreens(profile: Readonly<ProfileState>): void {
  const view = createProfileOverviewView(profile);
  renderEquipmentList(weaponCollection, view.collections.weapons);
  renderEquipmentList(armorCollection, view.collections.armor);
  collectionProgress.textContent =
    `${view.collections.totalDiscovered}/${view.collections.total} equipment discoveries · ` +
    `${view.progress.collectionPoints} collection points`;
  achievementList.replaceChildren(
    ...view.achievements.map((achievement) => {
      const item = document.createElement("li");
      const state = achievement.unlocked ? "Unlocked" : "Locked";
      item.dataset.achievementId = achievement.id;
      item.dataset.unlocked = String(achievement.unlocked);
      item.setAttribute(
        "aria-label",
        `${achievementLabel(achievement.id)}, ${state}`,
      );
      item.textContent = `${achievementLabel(achievement.id)} · ${state}`;
      return item;
    }),
  );
  achievementProgress.textContent =
    `${view.achievements.filter(({ unlocked }) => unlocked).length}/5 achievements unlocked · ` +
    `${view.progress.achievementPoints} achievement points · ` +
    `${view.progress.totalPoints} total points`;
}

const tutorialContent: Readonly<
  Record<TutorialPage, Readonly<{ title: string; copy: string }>>
> = Object.freeze({
  0: {
    title: "Basic survival",
    copy: "Keep moving and watch your lifespan. The run ends when it is depleted.",
  },
  1: {
    title: "Encounter and building interaction",
    copy: "Buildings appear along the route. When the current building is in range, use its action before it passes.",
  },
  2: {
    title: "Soul Shrine and lifespan restoration",
    copy: "A Soul Shrine restores your lifespan when you reach it and can afford its cached price.",
  },
  3: {
    title: "Automatic battle and item use",
    copy: "Combat runs automatically. During a battle, use your carried item when it helps you survive.",
  },
  4: {
    title: "Low lifespan warning",
    copy: "Your lifespan is running low. Look for a Soul Shrine or prepare for the run to end.",
  },
  5: {
    title: "Low HP warning",
    copy: "Your HP is low. Use a carried item during battle if one is available.",
  },
});
let renderedTutorialPage: TutorialPage | null = null;

function renderTutorial(observation: Readonly<GameObservation>): void {
  const page = observation.lifecycle.tutorialPage;
  tutorialPanel.hidden = page === null;
  if (page === null) {
    renderedTutorialPage = null;
    return;
  }
  if (renderedTutorialPage === page) {
    return;
  }
  const content = tutorialContent[page];
  tutorialPageLabel.textContent = `Tutorial page ${page + 1} of 6`;
  tutorialHeading.textContent = content.title;
  tutorialCopy.textContent = content.copy;
  renderedTutorialPage = page;
}

function renderPause(observation: Readonly<GameObservation>): void {
  pausePanel.hidden = !observation.lifecycle.paused;
  pauseButton.setAttribute(
    "aria-pressed",
    String(observation.lifecycle.paused),
  );
}

function syncControls(observation: Readonly<GameObservation>): void {
  const ended = observation.lifecycle.phase === "ended";
  dismissTutorialButton.disabled =
    ended || !observation.actions.canDismissTutorial;
  if (advanceButton !== undefined) advanceButton.disabled = ended;
  pauseButton.disabled = !observation.actions.canTogglePause;
  pauseButton.textContent = observation.lifecycle.paused ? "Resume" : "Pause";
  purchaseButton.disabled =
    ended || !observation.actions.canPurchaseCurrentEncounter;
  useItemButton.disabled = ended || !observation.actions.canUseCarriedItem;
  renderTutorial(observation);
  renderPause(observation);
}

function settingsStatusText(result: SettingsLoadResult): string {
  if (result.status === "empty") {
    return "Using default settings. Save changes below when ready.";
  }
  if (result.status === "loaded") {
    return "Settings loaded.";
  }
  return `Settings unavailable. Using defaults. Storage status: ${result.error.code}`;
}

function renderSettings(settings: Readonly<BrowserSettings>): void {
  tutorialPreference.checked = currentProfile.tutorialPreference === "enabled";
  soundMuted.checked = settings.sound.muted;
  soundVolume.value = String(settings.sound.volume);
  soundVolumeValue.value = `${Math.round(settings.sound.volume * 100)}%`;
  soundVolumeValue.textContent = soundVolumeValue.value;
  bindingTogglePause.value = settings.bindings.togglePause;
  bindingDismissTutorial.value = settings.bindings.dismissTutorial;
  bindingPurchase.value = settings.bindings.purchaseCurrentEncounter;
  bindingUseItem.value = settings.bindings.useCarriedItem;
}

function setSettingsStatus(
  message: string,
  errorCode: string | undefined = undefined,
): void {
  settingsStatus.textContent = message;
  if (errorCode === undefined) {
    delete settingsStatus.dataset.error;
  } else {
    settingsStatus.dataset.error = errorCode;
  }
}

function renderStorageNotice(): void {
  const messages: string[] = [];
  if (profileLoad.status === "failed") {
    messages.push(
      `Progress storage is unavailable (${profileLoad.error.code}). Runs can continue, but progress cannot be saved.`,
    );
  }
  if (settingsLoad.status === "failed") {
    messages.push(
      `Settings storage is unavailable (${settingsLoad.error.code}). Default controls are in use.`,
    );
  }
  storageNotice.textContent = messages.join(" ");
  storageNotice.hidden = messages.length === 0;
}

function readSettingsForm(): BrowserSettings {
  return normalizeSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    bindings: {
      togglePause: bindingTogglePause.value,
      dismissTutorial: bindingDismissTutorial.value,
      purchaseCurrentEncounter: bindingPurchase.value,
      useCarriedItem: bindingUseItem.value,
    },
    sound: {
      muted: soundMuted.checked,
      volume: soundVolume.valueAsNumber,
    },
  });
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

interface ActiveRun {
  readonly completionId: string;
  readonly initialProfile: ProfileState;
  session: BrowserGameplaySession | undefined;
  clock: BrowserGameplayClock | undefined;
  settlement: Readonly<CompletedRunSettlementInput> | undefined;
  commit: CompletedRunResult | undefined;
}

let activeRun: ActiveRun | undefined;

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
    resultCollections.disabled = true;
    resultAchievements.disabled = true;
    resultMainMenu.disabled = true;
    showScreen("result");
    return;
  }

  currentProfile = commit.profile;
  updateProfileSummary(currentProfile);
  renderProfileScreens(currentProfile);
  renderSettings(currentSettings);
  delete gameStatus.dataset.completionError;
  resultPresentation.showCommitted(commit.result, commit.status);
  resultCollections.disabled = false;
  resultAchievements.disabled = false;
  resultMainMenu.disabled = false;
  showScreen("result");
}

function commitCompletedRun(record: ActiveRun): void {
  if (record.settlement === undefined || activeRun !== record) {
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

function showTitle(): void {
  activeRun?.clock?.stop();
  activeRun = undefined;
  resultPresentation.reset();
  updateProfileSummary(currentProfile);
  renderProfileScreens(currentProfile);
  renderSettings(currentSettings);
  showScreen("title");
}

function showProfileScreen(screen: "collections" | "achievements"): void {
  profileReturnScreen = currentScreen === "result" ? "result" : "title";
  renderProfileScreens(currentProfile);
  showScreen(screen);
}

function showSettings(): void {
  settingsReturnScreen = currentScreen === "result" ? "result" : "title";
  renderSettings(currentSettings);
  showScreen("settings");
}

function returnFromProfileScreen(): void {
  showScreen(profileReturnScreen);
}

function returnFromSettings(): void {
  showScreen(settingsReturnScreen);
}

function startRun(profile: ProfileState, focus = true): void {
  activeRun?.clock?.stop();
  runNumber += 1;
  const record: ActiveRun = {
    completionId: window.crypto.randomUUID(),
    initialProfile: profile,
    session: undefined,
    clock: undefined,
    settlement: undefined,
    commit: undefined,
  };
  activeRun = record;
  currentProfile = profile;
  resultPresentation.reset();
  updateProfileSummary(profile);
  renderProfileScreens(profile);
  renderSettings(currentSettings);
  delete gameStatus.dataset.completionStatus;
  delete gameStatus.dataset.completionError;
  gameStatus.textContent = "Step 0";
  dismissTutorialButton.disabled = false;
  if (advanceButton !== undefined) advanceButton.disabled = false;
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";
  pauseButton.setAttribute("aria-pressed", "false");
  purchaseButton.disabled = true;
  useItemButton.disabled = true;
  pausePanel.hidden = true;
  renderedTutorialPage = null;
  tutorialPanel.hidden = false;
  showScreen("gameplay", focus);

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
      renderOnDispatch: manualClock,
      onTransition: ({ observation }) => {
        gameStatus.textContent = `Step ${observation.steps}`;
        syncControls(observation);
      },
      onCompletedRun: (run) => {
        record.settlement = run;
        commitCompletedRun(record);
      },
    },
  );
  if (!manualClock) {
    record.clock = createBrowserGameplayClock(record.session, {
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
    });
    record.clock.setVisible(document.visibilityState === "visible");
    record.clock.start();
  }
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

gameStatus.dataset.persistenceStatus = profileLoad.status;
if (profileLoad.status === "failed") {
  gameStatus.dataset.persistenceError = profileLoad.error.code;
}
gameStatus.dataset.settingsStatus = settingsLoad.status;
if (settingsLoad.status === "failed") {
  gameStatus.dataset.settingsError = settingsLoad.error.code;
}
setSettingsStatus(settingsStatusText(settingsLoad));
renderStorageNotice();
updateProfileSummary(currentProfile);
renderProfileScreens(currentProfile);
renderSettings(currentSettings);

let contentBox: CssDimensions | undefined;

const render = (): void => {
  if (contentBox === undefined) {
    return;
  }

  presentation.resize(contentBox, window.devicePixelRatio);
};

const dispatch = (commands: readonly GameCommand[]): void => {
  const session = activeRun?.session;
  if (session === undefined || currentScreen !== "gameplay") {
    return;
  }

  if (manualClock) {
    session.dispatch(commands);
    session.render(1);
  } else {
    activeRun?.clock?.enqueue(commands);
  }
};

dismissTutorialButton.addEventListener("click", () => {
  dispatch(commandsForDismissTutorialActivation());
});

advanceButton?.addEventListener("click", () => {
  dispatch(commandsForAdvanceActivation());
});

purchaseButton.addEventListener("click", () => {
  dispatch(commandsForPurchaseActivation());
});

useItemButton.addEventListener("click", () => {
  dispatch(commandsForItemUseActivation());
});

pauseButton.addEventListener("click", () => {
  dispatch([{ type: "toggle-pause" }]);
});

requiredElement<HTMLButtonElement>("#start-run").addEventListener(
  "click",
  () => {
    startRun(currentProfile);
  },
);
requiredElement<HTMLButtonElement>("#title-collections").addEventListener(
  "click",
  () => showProfileScreen("collections"),
);
requiredElement<HTMLButtonElement>("#title-achievements").addEventListener(
  "click",
  () => showProfileScreen("achievements"),
);
requiredElement<HTMLButtonElement>("#title-settings").addEventListener(
  "click",
  showSettings,
);
requiredElement<HTMLButtonElement>("#gameplay-main-menu").addEventListener(
  "click",
  showTitle,
);
requiredElement<HTMLButtonElement>("#result-main-menu").addEventListener(
  "click",
  showTitle,
);
requiredElement<HTMLButtonElement>("#result-view-collections").addEventListener(
  "click",
  () => showProfileScreen("collections"),
);
requiredElement<HTMLButtonElement>(
  "#result-view-achievements",
).addEventListener("click", () => showProfileScreen("achievements"));
requiredElement<HTMLButtonElement>("#collections-back").addEventListener(
  "click",
  returnFromProfileScreen,
);
requiredElement<HTMLButtonElement>("#achievements-back").addEventListener(
  "click",
  returnFromProfileScreen,
);
requiredElement<HTMLButtonElement>("#settings-back").addEventListener(
  "click",
  returnFromSettings,
);

soundVolume.addEventListener("input", () => {
  const volume = Number(soundVolume.value);
  soundVolumeValue.value = `${Math.round(volume * 100)}%`;
  soundVolumeValue.textContent = soundVolumeValue.value;
});

requiredElement<HTMLButtonElement>(
  "#restore-default-settings",
).addEventListener("click", () => {
  currentSettings = createDefaultSettings();
  renderSettings(currentSettings);
  setSettingsStatus(
    "Defaults restored in this form. Save settings to keep them.",
  );
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  let settings: BrowserSettings;
  try {
    settings = readSettingsForm();
  } catch {
    setSettingsStatus(
      "Settings could not be saved. Check each binding and the volume.",
      "invalid-record",
    );
    return;
  }

  const nextPreference = tutorialPreference.checked ? "enabled" : "disabled";
  if (nextPreference !== currentProfile.tutorialPreference) {
    const latest = profileStore.load();
    if (latest.status === "failed") {
      setSettingsStatus(
        `Tutorial preference could not be saved. Storage status: ${latest.error.code}`,
        latest.error.code,
      );
      return;
    }
    const profileSave = profileStore.save({
      ...latest.profile,
      tutorialPreference: nextPreference,
    });
    if (profileSave.status !== "saved") {
      setSettingsStatus(
        `Tutorial preference could not be saved. Storage status: ${profileSave.error.code}`,
        profileSave.error.code,
      );
      return;
    }
    currentProfile = profileSave.profile;
    updateProfileSummary(currentProfile);
    renderProfileScreens(currentProfile);
  }

  const settingsSave = settingsStore.save(settings);
  if (settingsSave.status !== "saved") {
    setSettingsStatus(
      `Settings could not be saved. Storage status: ${settingsSave.error.code}`,
      settingsSave.error.code,
    );
    return;
  }
  currentSettings = settingsSave.settings;
  gameStatus.dataset.settingsStatus = "loaded";
  delete gameStatus.dataset.settingsError;
  setSettingsStatus("Settings saved.");
});

document.addEventListener("visibilitychange", () => {
  activeRun?.clock?.setVisible(document.visibilityState === "visible");
});
window.addEventListener("pagehide", () => activeRun?.clock?.stop());
window.addEventListener("pageshow", () => {
  activeRun?.clock?.setVisible(document.visibilityState === "visible");
  activeRun?.clock?.start();
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

startRun(currentProfile, false);
