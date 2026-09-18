import type {
  BrowserSettings,
  SettingsLoadResult,
  SettingsStore,
} from "./application/settings.js";
import { createDefaultSettings } from "./application/settings.js";
import type {
  CompletedRunSettlementInput,
  GameCommand,
  GameEvent,
  GameObservation,
  ProfileLoadResult,
  ProfileState,
  ProfileStore,
  SoundStatus,
  SoundUiAction,
  TutorialPage,
} from "./application/contracts.js";
import { createCompletedRunCoordinator } from "./application/completed-run.js";
import { createGameplayEngine } from "./application/gameplay-engine.js";
import {
  createBrowserActiveRunController,
  type ActiveRunCompletion,
} from "./browser/active-run-controller.js";
import { CanvasPresentation } from "./browser/canvas-presentation.js";
import {
  CompletedRunPresentation,
  type PendingCompletedRunView,
} from "./browser/completed-run-presentation.js";
import { observeDevicePixelRatioChanges } from "./browser/device-pixel-ratio.js";
import { type CssDimensions } from "./browser/foundation.js";
import {
  createFullscreenController,
  type FullscreenState,
  type FullscreenStateChange,
} from "./browser/fullscreen.js";
import {
  commandsForAdvanceActivation,
  commandsForDismissTutorialActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
  commandsForTogglePauseActivation,
  bindingLabel,
  createKeyboardCommandRouter,
} from "./browser/input.js";
import { createHudView, describeAccessibleGameEvent } from "./browser/hud.js";
import {
  createScreenNavigation,
  type ScreenId,
} from "./browser/screen-navigation.js";
import {
  createSettingsController,
  settingsStatusText,
} from "./browser/settings-controller.js";
import { createFreshProfile } from "./domain/profile.js";
import { ORIGINAL_V13_RULESET_ID, ruleSetRegistry } from "./domain/rulesets.js";
import { createBrowserProfileStore } from "./persistence/browser-profile-store.js";
import { createBrowserSettingsStore } from "./persistence/browser-settings-store.js";
import { createBrowserSoundEffects } from "./sound/sound-effects.js";
import "./browser/style.css";

const gameplayEngine = createGameplayEngine(ruleSetRegistry);

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing browser element ${selector}`);
  }
  return element;
}

const appShell = requiredElement<HTMLElement>("#app-shell");
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
const devSeedOverride = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("seed")?.trim() || undefined
  : undefined;
const advanceButton = manualClock
  ? document.createElement("button")
  : undefined;
const gameplayControls = requiredElement<HTMLElement>(".gameplay-controls");
const gameplayStage = requiredElement<HTMLElement>(".gameplay-stage");
if (advanceButton !== undefined) {
  advanceButton.id = "advance-run";
  advanceButton.className = "stage-action";
  advanceButton.type = "button";
  advanceButton.textContent = "Advance run";
  gameplayControls.prepend(advanceButton);
}
const pauseButton = requiredElement<HTMLButtonElement>("#toggle-pause");
const fullscreenButton =
  requiredElement<HTMLButtonElement>("#toggle-fullscreen");
const fullscreenExitButton =
  requiredElement<HTMLButtonElement>("#exit-fullscreen");
const fullscreenLabel = requiredElement<HTMLElement>("#fullscreen-label");
const fullscreenStatus = requiredElement<HTMLElement>("#fullscreen-status");
const purchaseButton = requiredElement<HTMLButtonElement>(
  "#purchase-current-encounter",
);
const useItemButton = requiredElement<HTMLButtonElement>("#use-carried-item");
const gameStatus = requiredElement<HTMLElement>("#game-status");
const hudHeroHp = requiredElement<HTMLElement>("#hud-hero-hp");
const hudLifespan = requiredElement<HTMLElement>("#hud-lifespan");
const hudGold = requiredElement<HTMLElement>("#hud-gold");
const hudWeapon = requiredElement<HTMLElement>("#hud-weapon");
const hudArmor = requiredElement<HTMLElement>("#hud-armor");
const hudItem = requiredElement<HTMLElement>("#hud-item");
const hudScore = requiredElement<HTMLElement>("#hud-score");
const hudDay = requiredElement<HTMLElement>("#hud-day");
const hudCurrentEncounter = requiredElement<HTMLElement>(
  "#hud-current-encounter",
);
const hudCurrentEncounterDetail = requiredElement<HTMLElement>(
  "#hud-current-encounter-detail",
);
const hudUpcomingEncounters = requiredElement<HTMLOListElement>(
  "#hud-upcoming-encounters",
);
const hudContextTitle = requiredElement<HTMLElement>("#hud-context-title");
const hudContextDescription = requiredElement<HTMLElement>(
  "#hud-context-description",
);
const hudContextPrice = requiredElement<HTMLElement>("#hud-context-price");
const hudContextWarning = requiredElement<HTMLElement>("#hud-context-warning");
const hudBattle = requiredElement<HTMLElement>("#hud-battle");
const hudBattleEnemy = requiredElement<HTMLElement>("#hud-battle-enemy");
const hudBattleHp = requiredElement<HTMLElement>("#hud-battle-hp");
const hudBattleHpBar =
  requiredElement<HTMLProgressElement>("#hud-battle-hp-bar");
const hudBattleHeroPhase = requiredElement<HTMLElement>(
  "#hud-battle-hero-phase",
);
const hudBattleEnemyPhase = requiredElement<HTMLElement>(
  "#hud-battle-enemy-phase",
);
const gameFeedback = requiredElement<HTMLElement>("#game-feedback");
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
const playerStatusLevel = requiredElement<HTMLElement>("#player-status-level");
const playerStatusXp = requiredElement<HTMLElement>("#player-status-xp");
const equipmentPreview = requiredElement<HTMLElement>("#equipment-preview");
const playerStatusChallenges = requiredElement<HTMLUListElement>(
  "#player-status-challenges",
);
const playerStatusProgress = requiredElement<HTMLElement>(
  "#player-status-progress",
);
const achievementList = requiredElement<HTMLUListElement>("#achievement-list");
const achievementProgress = requiredElement<HTMLElement>(
  "#achievements-progress",
);
const settingsStatus = requiredElement<HTMLElement>("#settings-status");
const soundStatus = requiredElement<HTMLElement>("#sound-status");
const settingsBindingPrompt = requiredElement<HTMLElement>(
  "#settings-binding-prompt",
);
const settingsForm = requiredElement<HTMLFormElement>("#settings-form");
const tutorialPreference = requiredElement<HTMLInputElement>(
  "#tutorial-preference",
);
const titleTutorialToggle = requiredElement<HTMLInputElement>(
  "#title-tutorial-toggle",
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
const bindingInputs = Object.freeze({
  togglePause: bindingTogglePause,
  dismissTutorial: bindingDismissTutorial,
  purchaseCurrentEncounter: bindingPurchase,
  useCarriedItem: bindingUseItem,
});
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

function soundStatusText(status: SoundStatus): string {
  switch (status) {
    case "uninitialized":
      return "Original music and sound start after the first player interaction.";
    case "loading":
      return "Loading original music and sound.";
    case "ready":
      return "Original music and sound ready.";
    case "degraded":
      return "Some original music or sound is unavailable. Gameplay continues.";
    case "suspended":
      return "Sound is paused while the page is hidden or playback is waiting for browser permission.";
    case "unavailable":
      return "Audio is unavailable. Gameplay continues without sound.";
    case "failed":
      return "Original music and sound could not be decoded. Gameplay continues without audio.";
  }
}

const soundEffects = createBrowserSoundEffects({
  onStatusChange: (status) => {
    soundStatus.textContent = soundStatusText(status);
    gameStatus.dataset.soundStatus = status;
  },
});
soundEffects.setPreferences(currentSettings.sound);

const keyboardRouter = createKeyboardCommandRouter(currentSettings.bindings);
let latestObservation: Readonly<GameObservation> | undefined;
let latestFeedback = "";

const presentation = new CanvasPresentation(canvas);
const reducedMotionQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const screens: Readonly<Record<ScreenId, HTMLElement>> = Object.freeze({
  title: titleScreen,
  gameplay: gameplayScreen,
  result: resultRoot,
  collections: collectionsScreen,
  achievements: achievementsScreen,
  settings: settingsScreen,
});

function fullscreenStatusText(state: FullscreenState): string {
  switch (state) {
    case "unsupported":
      return "Fullscreen is not available in this browser.";
    case "available":
      return "Fullscreen is available.";
    case "active":
      return "Fullscreen is active. Use Exit fullscreen to leave it.";
    case "denied":
      return "Fullscreen request was denied. Check browser permissions and try again.";
  }
}

function renderFullscreen(change: FullscreenStateChange): void {
  const label = change.active ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenButton.disabled = !change.supported;
  fullscreenButton.hidden = change.active;
  fullscreenExitButton.hidden = !change.active;
  fullscreenExitButton.disabled = !change.active;
  fullscreenLabel.textContent = label;
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.title = label;
  fullscreenButton.setAttribute("aria-pressed", String(change.active));
  fullscreenStatus.textContent = fullscreenStatusText(change.state);
  fullscreenStatus.dataset.state = change.state;
}

const fullscreenController = createFullscreenController(appShell, {
  onStateChange: renderFullscreen,
});

const tutorialContent: Readonly<
  Record<TutorialPage, Readonly<{ title: string; copy: string }>>
> = Object.freeze({
  0: {
    title: "Basic survival",
    copy: "Guide the Knight to survive as long as possible using only a single click every time! Game will end if your lifespan or HP becomes 0. Getting hit by the Enemy reduces your HP, while Lifespan reduces gradually over time.",
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

function renderHud(observation: Readonly<GameObservation>): void {
  const view = createHudView(observation);
  hudHeroHp.textContent = view.player.hp;
  hudLifespan.textContent = view.player.lifespan;
  hudGold.textContent = view.player.gold;
  hudWeapon.textContent = view.player.weapon;
  hudArmor.textContent = view.player.armor;
  hudItem.textContent = view.player.item;
  hudScore.textContent = view.player.score;
  hudDay.textContent = view.player.day;
  hudCurrentEncounter.textContent = view.currentEncounter.label;
  hudCurrentEncounterDetail.textContent = view.currentEncounter.detail;
  hudUpcomingEncounters.replaceChildren(
    ...view.upcomingEncounters.map((encounter, index) => {
      const item = document.createElement("li");
      item.dataset.queueIndex = String(index);
      item.setAttribute(
        "aria-label",
        `${encounter.label}. ${encounter.detail}`,
      );
      item.textContent = `${encounter.label} · ${encounter.detail}`;
      return item;
    }),
  );
  hudContextTitle.textContent = view.context.title;
  hudContextDescription.textContent = view.context.description;
  hudContextPrice.textContent =
    view.context.price === null ? "" : `Price: ${view.context.price}`;
  hudContextWarning.textContent = view.context.warning ?? "";
  hudContextWarning.hidden = view.context.warning === null;
  hudBattle.hidden = view.battle === null;
  if (view.battle !== null) {
    hudBattleEnemy.textContent = view.battle.enemy;
    hudBattleHp.textContent = `HP ${view.battle.hp}`;
    hudBattleHpBar.value = view.battle.hpPercent;
    hudBattleHpBar.setAttribute("aria-valuetext", `${view.battle.hp} HP`);
    hudBattleHeroPhase.textContent =
      observation.battle?.actors.hero.phase ?? "—";
    hudBattleEnemyPhase.textContent =
      observation.battle?.actors.enemy.phase ?? "—";
  } else {
    hudBattleHpBar.value = 0;
    hudBattleHpBar.removeAttribute("aria-valuetext");
  }
}

function renderFeedback(events: readonly GameEvent[]): void {
  const announcement = events
    .map(describeAccessibleGameEvent)
    .filter(Boolean)
    .join(" ");
  if (announcement !== "") {
    latestFeedback = announcement;
    gameFeedback.textContent = latestFeedback;
  }
}

function syncControls(observation: Readonly<GameObservation>): void {
  const ended = observation.lifecycle.phase === "ended";
  gameplayStage.dataset.paused = String(observation.lifecycle.paused);
  gameplayStage.dataset.phase = observation.lifecycle.phase;
  if (observation.lifecycle.tutorialPage === null) {
    delete gameplayStage.dataset.tutorialPage;
  } else {
    gameplayStage.dataset.tutorialPage = String(
      observation.lifecycle.tutorialPage,
    );
  }
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

function primeSound(): void {
  void soundEffects.initialize();
}

function presentUiAction(action: SoundUiAction): void {
  primeSound();
  soundEffects.presentUiAction(action);
}

function runUiAction(action: SoundUiAction, callback: () => void): void {
  callback();
  presentUiAction(action);
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

function renderCompletion(completion: ActiveRunCompletion): void {
  const settlement = completion.settlement;
  const commit = completion.commit;
  if (settlement === undefined || commit === undefined) {
    return;
  }

  gameStatus.dataset.completionStatus = commit.status;
  if (commit.status === "failed" || commit.status === "uncertain") {
    gameStatus.dataset.completionError = commit.error.code;
    resultCollections.disabled = true;
    resultAchievements.disabled = true;
    resultMainMenu.disabled = true;
    screenNavigation?.show("result");
    resultPresentation.showPending(
      pendingView(settlement),
      commit.status,
      commit.error.code,
    );
    soundEffects.presentResult();
    return;
  }

  currentProfile = commit.profile;
  screenNavigation?.updateProfileSummary(currentProfile);
  screenNavigation?.renderProfileScreens(currentProfile);
  settingsController?.render(currentSettings);
  delete gameStatus.dataset.completionError;
  resultCollections.disabled = false;
  resultAchievements.disabled = false;
  resultMainMenu.disabled = false;
  screenNavigation?.show("result");
  resultPresentation.showCommitted(commit.result, commit.status);
  soundEffects.presentResult();
}

const resultPresentation = new CompletedRunPresentation(resultRoot, {
  onRetry: () => {
    if (activeRunController?.readCompletion()?.settlement !== undefined) {
      activeRunController.commitCurrentRun();
      presentUiAction("confirm");
    }
  },
  onNextRun: () => {
    const commit = activeRunController?.readCompletion()?.commit;
    if (
      commit !== undefined &&
      (commit.status === "committed" || commit.status === "already-committed")
    ) {
      activeRunController?.start(commit.profile, { startImmediately: true });
    }
  },
  onScoreCountingChanged: (counting) => soundEffects.setScoreCounting(counting),
});

const screenNavigation = createScreenNavigation(
  {
    screens,
    profileSummary,
    titleProfileSummary,
    weaponCollection,
    armorCollection,
    collectionProgress,
    playerStatusLevel,
    playerStatusXp,
    equipmentPreview,
    playerStatusChallenges,
    playerStatusProgress,
    achievementList,
    achievementProgress,
  },
  {
    readProfile: () => currentProfile,
    onLeaveGameplay: () => {
      soundEffects.stopEffects();
    },
    beforeShowTitle: () => {
      activeRunController?.stop();
      resultPresentation.reset();
    },
    prepareSettings: () => settingsController?.prepare(),
    renderSettings: () => settingsController?.render(currentSettings),
  },
);

const settingsController = createSettingsController(
  {
    status: settingsStatus,
    bindingPrompt: settingsBindingPrompt,
    form: settingsForm,
    tutorialPreference,
    titleTutorialToggle,
    soundMuted,
    soundVolume,
    soundVolumeValue,
    bindingInputs,
    restoreDefaults: requiredElement<HTMLButtonElement>(
      "#restore-default-settings",
    ),
    remapButtons: [
      ...document.querySelectorAll<HTMLButtonElement>("[data-remap-action]"),
    ],
  },
  {
    readProfile: () => currentProfile,
    loadProfile: () => profileStore.load(),
    saveProfile: (profile) => profileStore.save(profile),
    readSettings: () => currentSettings,
    saveSettings: (settings) => settingsStore.save(settings),
    onProfileChanged: (profile) => {
      currentProfile = profile;
      screenNavigation?.updateProfileSummary(profile);
      screenNavigation?.renderProfileScreens(profile);
    },
    onSettingsChanged: (settings) => {
      currentSettings = settings;
      keyboardRouter.replaceBindings(settings.bindings);
      soundEffects.setPreferences(settings.sound);
      gameStatus.dataset.settingsStatus = "loaded";
      delete gameStatus.dataset.settingsError;
    },
    onBindingsChanged: (bindings) => {
      pauseButton.setAttribute(
        "aria-keyshortcuts",
        bindingLabel(bindings.togglePause),
      );
      dismissTutorialButton.setAttribute(
        "aria-keyshortcuts",
        bindingLabel(bindings.dismissTutorial),
      );
      purchaseButton.setAttribute(
        "aria-keyshortcuts",
        bindingLabel(bindings.purchaseCurrentEncounter),
      );
      useItemButton.setAttribute(
        "aria-keyshortcuts",
        bindingLabel(bindings.useCarriedItem),
      );
    },
    onPrimeSound: primeSound,
    onUiAction: (action) => soundEffects.presentUiAction(action),
  },
  currentSettings.bindings,
);

const diagnosticsRequested =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("diagnostics") === "1";

const activeRunController = createBrowserActiveRunController({
  gameplayEngine,
  presentation,
  completedRunCoordinator: createCompletedRunCoordinator(profileStore),
  sound: soundEffects,
  ruleset: ORIGINAL_V13_RULESET_ID,
  manualClock,
  retainDiagnostics: diagnosticsRequested,
  devSeedOverride,
  isGameplayScreen: () => screenNavigation?.current() === "gameplay",
  readSettings: () => currentSettings,
  onPrimeSound: primeSound,
  onRunStarted: (profile, focus) => {
    currentProfile = profile;
    resultPresentation.reset();
    screenNavigation?.updateProfileSummary(profile);
    screenNavigation?.renderProfileScreens(profile);
    settingsController?.render(currentSettings);
    delete gameStatus.dataset.completionStatus;
    delete gameStatus.dataset.completionError;
    gameStatus.textContent = "Step 0";
    latestFeedback = "";
    gameFeedback.textContent = "";
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
    screenNavigation?.show("gameplay", focus);
  },
  onInitialObservation: (observation) => {
    latestObservation = observation;
    renderHud(observation);
    syncControls(observation);
  },
  onTransition: ({ observation, events }) => {
    latestObservation = observation;
    gameStatus.textContent = `Step ${observation.steps}`;
    renderHud(observation);
    renderFeedback(events);
    syncControls(observation);
  },
  onCompletionChanged: (completion) => {
    if (completion.sessionOverDismissed) renderCompletion(completion);
  },
});

function syncReducedMotion(): void {
  const reducedMotion = reducedMotionQuery?.matches ?? false;
  presentation.setReducedMotion(reducedMotion);
  resultPresentation.setReducedMotion(reducedMotion);
  document.documentElement.dataset.reducedMotion = String(reducedMotion);
}

syncReducedMotion();
reducedMotionQuery?.addEventListener("change", syncReducedMotion);

if (diagnosticsRequested) {
  window.triggerKnightDiagnostics = Object.freeze({
    read: () => {
      if (activeRunController === undefined) {
        throw new Error("No active browser gameplay session");
      }
      return activeRunController.readDiagnostics();
    },
  });
}

if (import.meta.env.DEV) {
  window.triggerKnightSoundDiagnostics = Object.freeze({
    read: () => soundEffects.readDiagnostics(),
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
settingsController?.setStatus(settingsStatusText(settingsLoad));
renderStorageNotice();
screenNavigation?.updateProfileSummary(currentProfile);
screenNavigation?.renderProfileScreens(currentProfile);
settingsController?.render(currentSettings);

let contentBox: CssDimensions | undefined;

const render = (): void => {
  if (contentBox === undefined) {
    return;
  }

  presentation.resize(contentBox, window.devicePixelRatio);
};

const dispatch = (commands: readonly GameCommand[]): void => {
  activeRunController?.dispatch(commands);
};

function editableEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

function nativeActivationTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement && !target.disabled;
}

function nativeActivationCode(code: string): boolean {
  return code === "Enter" || code === "Space";
}

document.addEventListener("keydown", (event) => {
  if (settingsController?.handleKeyDown(event)) return;

  if (event.isComposing || screenNavigation?.current() !== "gameplay") {
    return;
  }
  if (editableEventTarget(event.target)) return;
  if (event.repeat) {
    if (
      nativeActivationTarget(event.target) &&
      nativeActivationCode(event.code)
    ) {
      event.preventDefault();
    }
    return;
  }
  if (
    nativeActivationTarget(event.target) &&
    nativeActivationCode(event.code)
  ) {
    return;
  }

  const observation = latestObservation;
  if (observation === undefined) return;
  if (observation.lifecycle.phase === "ended") {
    if (!nativeActivationCode(event.code)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    if (activeRunController?.dismissSessionOver()) {
      presentUiAction("activate");
    }
    return;
  }
  const commands = keyboardRouter.commandsFor(event.code, observation.actions);
  if (commands.length === 0) return;
  event.preventDefault();
  dispatch(commands);
});

gameplayStage.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (screenNavigation?.current() !== "gameplay") return;
  if (event.target instanceof HTMLButtonElement) return;
  const observation = latestObservation;
  if (observation !== undefined && observation.lifecycle.phase === "ended") {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    if (activeRunController?.dismissSessionOver()) {
      presentUiAction("activate");
    }
    return;
  }
  if (
    observation !== undefined &&
    observation.lifecycle.tutorialPage !== null &&
    observation.actions.canDismissTutorial
  ) {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    dispatch(commandsForDismissTutorialActivation());
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (screenNavigation?.current() !== "gameplay") return;
  const observation = latestObservation;
  if (observation === undefined) return;
  if (observation.lifecycle.phase === "ended") return;
  if (observation.lifecycle.tutorialPage !== null) return;
  if (
    observation.battle !== null &&
    observation.player.inventory.item !== null &&
    observation.actions.canUseCarriedItem
  ) {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    dispatch(commandsForItemUseActivation());
    return;
  }
  const current = observation.encounters.current;
  if (
    current?.kind !== "shop" ||
    !observation.actions.canPurchaseCurrentEncounter
  ) {
    return;
  }

  event.preventDefault();
  canvas.focus({ preventScroll: true });
  dispatch(commandsForPurchaseActivation());
});

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
  runUiAction("activate", () => dispatch(commandsForTogglePauseActivation()));
});

fullscreenButton.addEventListener("click", () => {
  runUiAction("activate", () => {
    void fullscreenController.toggle();
  });
});

fullscreenExitButton.addEventListener("click", () => {
  runUiAction("cancel", () => {
    void fullscreenController.exit();
  });
});

requiredElement<HTMLButtonElement>("#start-run").addEventListener("click", () =>
  activeRunController?.start(currentProfile, { startImmediately: true }),
);
requiredElement<HTMLButtonElement>("#title-collections").addEventListener(
  "click",
  () =>
    runUiAction("activate", () =>
      screenNavigation?.showProfileScreen("collections"),
    ),
);
requiredElement<HTMLButtonElement>("#title-achievements").addEventListener(
  "click",
  () =>
    runUiAction("activate", () =>
      screenNavigation?.showProfileScreen("achievements"),
    ),
);
requiredElement<HTMLButtonElement>("#title-settings").addEventListener(
  "click",
  () => runUiAction("activate", () => screenNavigation?.showSettings()),
);
requiredElement<HTMLButtonElement>("#gameplay-main-menu").addEventListener(
  "click",
  () => runUiAction("cancel", () => screenNavigation?.showTitle()),
);
requiredElement<HTMLButtonElement>("#result-main-menu").addEventListener(
  "click",
  () => runUiAction("cancel", () => screenNavigation?.showTitle()),
);
requiredElement<HTMLButtonElement>("#result-view-collections").addEventListener(
  "click",
  () =>
    runUiAction("activate", () =>
      screenNavigation?.showProfileScreen("collections"),
    ),
);
requiredElement<HTMLButtonElement>(
  "#result-view-achievements",
).addEventListener("click", () =>
  runUiAction("activate", () =>
    screenNavigation?.showProfileScreen("achievements"),
  ),
);
requiredElement<HTMLButtonElement>("#collections-back").addEventListener(
  "click",
  () =>
    runUiAction("cancel", () => screenNavigation?.returnFromProfileScreen()),
);
requiredElement<HTMLButtonElement>("#achievements-back").addEventListener(
  "click",
  () =>
    runUiAction("cancel", () => screenNavigation?.returnFromProfileScreen()),
);
requiredElement<HTMLButtonElement>("#settings-back").addEventListener(
  "click",
  () => runUiAction("cancel", () => screenNavigation?.returnFromSettings()),
);

function presentButtonSelect(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button");
  if (button === null || button.disabled) return;
  presentUiAction("select");
}

document.addEventListener("pointerover", (event) => {
  const target = event.target;
  if (
    event.relatedTarget instanceof Node &&
    target instanceof Element &&
    target.closest("button")?.contains(event.relatedTarget)
  ) {
    return;
  }
  presentButtonSelect(target);
});
document.addEventListener("focusin", (event) => {
  presentButtonSelect(event.target);
});

document.addEventListener("visibilitychange", () => {
  const visible = document.visibilityState === "visible";
  activeRunController?.setVisible(visible);
  soundEffects.setVisible(visible);
});
window.addEventListener("pagehide", () => {
  activeRunController?.suspend();
  soundEffects.setVisible(false);
});
window.addEventListener("pageshow", () => {
  const visible = document.visibilityState === "visible";
  activeRunController?.setVisible(visible);
  activeRunController?.resume();
  soundEffects.setVisible(visible);
});

observeDevicePixelRatioChanges(window, render);
window.addEventListener("resize", render);
document.addEventListener("fullscreenchange", render);

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

activeRunController?.start(currentProfile, {
  focus: false,
  startImmediately: true,
});
