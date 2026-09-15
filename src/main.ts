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
  GameEvent,
  GameObservation,
  ProfileLoadResult,
  ProfileState,
  ProfileStore,
  SoundStatus,
  SoundUiAction,
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
import { type CssDimensions } from "./browser/foundation.js";
import {
  createFullscreenController,
  type FullscreenState,
  type FullscreenStateChange,
} from "./browser/fullscreen.js";
import {
  createBrowserGameplaySession,
  type BrowserGameplaySession,
} from "./browser/gameplay-session.js";
import {
  commandsForAdvanceActivation,
  commandsForDismissTutorialActivation,
  commandsForItemUseActivation,
  commandsForPurchaseActivation,
  commandsForTogglePauseActivation,
  bindingLabel,
  createBindingCaptureController,
  createKeyboardCommandRouter,
  findBindingConflict,
  type InputAction,
} from "./browser/input.js";
import { createHudView, describeAccessibleGameEvent } from "./browser/hud.js";
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
const bindingInputs: Readonly<Record<InputAction, HTMLInputElement>> =
  Object.freeze({
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
      return "Sound effects start after the first player interaction.";
    case "loading":
      return "Loading sound effects.";
    case "ready":
      return "Sound effects ready.";
    case "degraded":
      return "Some sound effects are unavailable. Gameplay continues.";
    case "suspended":
      return "Sound is paused while the page is hidden or playback is waiting for browser permission.";
    case "unavailable":
      return "Audio is unavailable. Gameplay continues without sound.";
    case "failed":
      return "Sound effects could not be decoded. Gameplay continues without sound.";
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
const bindingCapture = createBindingCaptureController(currentSettings.bindings);
let latestObservation: Readonly<GameObservation> | undefined;
let latestFeedback = "";

const completedRunCoordinator = createCompletedRunCoordinator(profileStore);
const presentation = new CanvasPresentation(canvas);
const reducedMotionQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
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
  fullscreenLabel.textContent = label;
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.title = label;
  fullscreenButton.setAttribute("aria-pressed", String(change.active));
  fullscreenStatus.textContent = fullscreenStatusText(change.state);
  fullscreenStatus.dataset.state = change.state;
}

const fullscreenController = createFullscreenController(gameplayScreen, {
  onStateChange: renderFullscreen,
});

let currentScreen: ScreenId = "gameplay";
let profileReturnScreen: "title" | "result" = "title";
let settingsReturnScreen: "title" | "result" = "title";

function showScreen(screen: ScreenId, focus = true): void {
  if (screen !== "gameplay") void fullscreenController.exit();
  if (screen !== "gameplay") soundEffects.stop();
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "equipment-slot";
      const state = entry.discovered ? "Discovered" : "Not discovered";
      item.dataset.tier = String(entry.tier);
      item.dataset.discovered = String(entry.discovered);
      button.dataset.equipmentName = entry.name;
      button.dataset.equipmentTier = String(entry.tier);
      button.dataset.discovered = String(entry.discovered);
      button.setAttribute(
        "aria-label",
        `Tier ${entry.tier}, ${entry.name}, ${state}`,
      );
      button.title = `${entry.name} · ${state}`;
      button.textContent = entry.discovered ? "■" : "□";
      item.append(
        button,
        document.createTextNode(` Tier ${entry.tier}: ${entry.name}`),
      );
      return item;
    }),
  );
}

function renderPlayerStatus(view: Readonly<ProfileOverviewView>): void {
  equipmentPreview.dataset.state = "empty";
  playerStatusLevel.textContent = `Level ${view.level} (x${view.scoreMultiplier} Score)`;
  playerStatusXp.textContent = `${view.xp} XP`;
  playerStatusProgress.textContent = `Game Progress - ${Math.round((view.collections.totalDiscovered / view.collections.total) * 100)}%`;
  playerStatusChallenges.replaceChildren(
    ...view.achievements.map((achievement) => {
      const item = document.createElement("li");
      item.dataset.unlocked = String(achievement.unlocked);
      item.textContent = `${achievementLabel(achievement.id)} ${achievement.unlocked ? "■" : "□"}`;
      return item;
    }),
  );
}

function renderProfileScreens(profile: Readonly<ProfileState>): void {
  const view = createProfileOverviewView(profile);
  renderEquipmentList(weaponCollection, view.collections.weapons);
  renderEquipmentList(armorCollection, view.collections.armor);
  renderPlayerStatus(view);
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

function showEquipmentPreview(target: EventTarget | null): void {
  if (!(target instanceof HTMLButtonElement)) return;
  const name = target.dataset.equipmentName;
  const tier = target.dataset.equipmentTier;
  const discovered = target.dataset.discovered === "true";
  if (name === undefined || tier === undefined) return;
  equipmentPreview.dataset.state = "selected";
  equipmentPreview.textContent = discovered
    ? `${name}, tier ${tier}. This equipment is available in future runs.`
    : `${name}, tier ${tier}. This equipment has not been discovered yet.`;
}

for (const list of [weaponCollection, armorCollection]) {
  list.addEventListener("pointerover", (event) => {
    showEquipmentPreview(event.target);
  });
  list.addEventListener("focusin", (event) => {
    showEquipmentPreview(event.target);
  });
  list.addEventListener("click", (event) => {
    showEquipmentPreview(event.target);
  });
}

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

function renderKeyboardHints(
  bindings: Readonly<BrowserSettings["bindings"]>,
): void {
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
  const tutorialsEnabled = currentProfile.tutorialPreference === "enabled";
  tutorialPreference.checked = tutorialsEnabled;
  titleTutorialToggle.checked = tutorialsEnabled;
  soundMuted.checked = settings.sound.muted;
  soundVolume.value = String(settings.sound.volume);
  soundVolumeValue.value = `${Math.round(settings.sound.volume * 100)}%`;
  soundVolumeValue.textContent = soundVolumeValue.value;
  bindingTogglePause.value = settings.bindings.togglePause;
  bindingDismissTutorial.value = settings.bindings.dismissTutorial;
  bindingPurchase.value = settings.bindings.purchaseCurrentEncounter;
  bindingUseItem.value = settings.bindings.useCarriedItem;
  renderKeyboardHints(settings.bindings);
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

function readSettingsForm(): BrowserSettings {
  const bindings = {
    togglePause: bindingTogglePause.value,
    dismissTutorial: bindingDismissTutorial.value,
    purchaseCurrentEncounter: bindingPurchase.value,
    useCarriedItem: bindingUseItem.value,
  };
  const conflict = findBindingConflict(bindings);
  if (conflict !== null) {
    throw new TypeError(
      `${bindingLabel(conflict.code)} is assigned to multiple actions`,
    );
  }
  return normalizeSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    bindings,
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
  sessionOverDismissed: boolean;
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
  if (record.sessionOverDismissed) renderCompletion(record);
}

const resultPresentation = new CompletedRunPresentation(resultRoot, {
  onRetry: () => {
    if (activeRun?.settlement !== undefined) {
      commitCompletedRun(activeRun);
      presentUiAction("confirm");
    }
  },
  onNextRun: () => {
    const commit = activeRun?.commit;
    if (
      commit !== undefined &&
      (commit.status === "committed" || commit.status === "already-committed")
    ) {
      startRun(commit.profile, { startImmediately: true });
      presentUiAction("activate");
    }
  },
});

function dismissSessionOver(): void {
  const record = activeRun;
  if (
    currentScreen !== "gameplay" ||
    record === undefined ||
    record.settlement === undefined ||
    record.commit === undefined ||
    latestObservation?.lifecycle.phase !== "ended"
  ) {
    return;
  }
  record.sessionOverDismissed = true;
  renderCompletion(record);
  presentUiAction("activate");
}

function syncReducedMotion(): void {
  const reducedMotion = reducedMotionQuery?.matches ?? false;
  presentation.setReducedMotion(reducedMotion);
  resultPresentation.setReducedMotion(reducedMotion);
  document.documentElement.dataset.reducedMotion = String(reducedMotion);
}

syncReducedMotion();
reducedMotionQuery?.addEventListener("change", syncReducedMotion);

function showTitle(): void {
  activeRun?.clock?.stop();
  activeRun = undefined;
  soundEffects.setSession(null);
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
  bindingCapture.replaceBindings(currentSettings.bindings);
  settingsBindingPrompt.textContent =
    "Choose Remap, then press a supported key. Press Escape to cancel.";
  showScreen("settings");
}

function returnFromProfileScreen(): void {
  showScreen(profileReturnScreen);
}

function returnFromSettings(): void {
  bindingCapture.replaceBindings(currentSettings.bindings);
  settingsBindingPrompt.textContent =
    "Choose Remap, then press a supported key. Press Escape to cancel.";
  showScreen(settingsReturnScreen);
}

function bindingActionLabel(action: InputAction): string {
  switch (action) {
    case "togglePause":
      return "Pause";
    case "dismissTutorial":
      return "Dismiss tutorial";
    case "purchaseCurrentEncounter":
      return "Purchase current encounter";
    case "useCarriedItem":
      return "Use carried item";
  }
}

function isInputAction(value: string | undefined): value is InputAction {
  return (
    value === "togglePause" ||
    value === "dismissTutorial" ||
    value === "purchaseCurrentEncounter" ||
    value === "useCarriedItem"
  );
}

function handleBindingCaptureResult(
  result: ReturnType<
    ReturnType<typeof createBindingCaptureController>["handleKeyDown"]
  >,
): void {
  switch (result.status) {
    case "captured":
      bindingInputs[result.action].value = result.code;
      settingsBindingPrompt.textContent = `${bindingActionLabel(result.action)} is ${bindingLabel(result.code)}. Save settings to keep it.`;
      break;
    case "cancelled":
      settingsBindingPrompt.textContent = `${bindingActionLabel(result.action)} remapping cancelled.`;
      break;
    case "conflict":
      settingsBindingPrompt.textContent = `${bindingLabel(result.code)} is already assigned to ${bindingActionLabel(result.conflictingAction)}. Choose another key or press Escape to cancel.`;
      break;
    case "unsupported":
      settingsBindingPrompt.textContent = `${result.code || "That key"} is not supported. Choose another key or press Escape to cancel.`;
      break;
    case "ignored":
      break;
  }
}

function beginBindingCapture(action: InputAction): void {
  bindingCapture.begin(action);
  settingsBindingPrompt.textContent = `Press a key for ${bindingActionLabel(action)}. Press Escape to cancel.`;
  bindingInputs[action].focus();
}

interface StartRunOptions {
  readonly focus?: boolean;
  readonly startImmediately?: boolean;
}

function startRun(
  profile: ProfileState,
  { focus = true, startImmediately = false }: StartRunOptions = {},
): void {
  activeRun?.clock?.stop();
  runNumber += 1;
  const record: ActiveRun = {
    completionId: window.crypto.randomUUID(),
    initialProfile: profile,
    session: undefined,
    clock: undefined,
    settlement: undefined,
    commit: undefined,
    sessionOverDismissed: false,
  };
  activeRun = record;
  soundEffects.setSession(record.completionId);
  soundEffects.setPreferences(currentSettings.sound);
  currentProfile = profile;
  resultPresentation.reset();
  updateProfileSummary(profile);
  renderProfileScreens(profile);
  renderSettings(currentSettings);
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
  showScreen("gameplay", focus);

  const seed =
    devSeedOverride === undefined
      ? runNumber === 1
        ? "browser-run"
        : `browser-run-${runNumber}`
      : runNumber === 1
        ? devSeedOverride
        : `${devSeedOverride}-${runNumber}`;
  const config = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile: profile,
    ...(startImmediately ? { startImmediately: true } : {}),
  };
  record.session = createBrowserGameplaySession(
    gameplayEngine,
    Object.freeze(config),
    presentation,
    {
      retainDiagnostics: import.meta.env.DEV,
      renderOnDispatch: manualClock,
      onTransition: ({ observation, events }) => {
        if (activeRun !== record) return;
        latestObservation = observation;
        gameStatus.textContent = `Step ${observation.steps}`;
        renderHud(observation);
        renderFeedback(events);
        syncControls(observation);
        soundEffects.presentTransition(
          record.completionId,
          observation.steps,
          events,
        );
      },
      onCompletedRun: (run) => {
        record.settlement = run;
        commitCompletedRun(record);
      },
    },
  );
  latestObservation = record.session.readObservation();
  renderHud(latestObservation);
  syncControls(latestObservation);
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

  primeSound();

  if (manualClock) {
    session.dispatch(commands);
    session.render(1);
  } else {
    activeRun?.clock?.enqueue(commands);
  }
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
  const activeBinding = bindingCapture.activeAction();
  if (activeBinding !== null) {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    primeSound();
    handleBindingCaptureResult(bindingCapture.handleKeyDown(event.code));
    return;
  }

  if (event.isComposing || currentScreen !== "gameplay") {
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
    dismissSessionOver();
    return;
  }
  const commands = keyboardRouter.commandsFor(event.code, observation.actions);
  if (commands.length === 0) return;
  event.preventDefault();
  dispatch(commands);
});

gameplayStage.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (currentScreen !== "gameplay") return;
  if (event.target instanceof HTMLButtonElement) return;
  const observation = latestObservation;
  if (observation !== undefined && observation.lifecycle.phase === "ended") {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    dismissSessionOver();
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
  if (currentScreen !== "gameplay") return;
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
  dispatch(commandsForTogglePauseActivation());
});

fullscreenButton.addEventListener("click", () => {
  runUiAction("activate", () => {
    void fullscreenController.toggle();
  });
});

requiredElement<HTMLButtonElement>("#start-run").addEventListener(
  "click",
  () => {
    runUiAction("activate", () =>
      startRun(currentProfile, { startImmediately: true }),
    );
  },
);
requiredElement<HTMLButtonElement>("#title-collections").addEventListener(
  "click",
  () => runUiAction("activate", () => showProfileScreen("collections")),
);
requiredElement<HTMLButtonElement>("#title-achievements").addEventListener(
  "click",
  () => runUiAction("activate", () => showProfileScreen("achievements")),
);
requiredElement<HTMLButtonElement>("#title-settings").addEventListener(
  "click",
  () => runUiAction("activate", showSettings),
);
titleTutorialToggle.addEventListener("change", () => {
  tutorialPreference.checked = titleTutorialToggle.checked;
  settingsForm.requestSubmit();
});
requiredElement<HTMLButtonElement>("#gameplay-main-menu").addEventListener(
  "click",
  () => runUiAction("cancel", showTitle),
);
requiredElement<HTMLButtonElement>("#result-main-menu").addEventListener(
  "click",
  () => runUiAction("cancel", showTitle),
);
requiredElement<HTMLButtonElement>("#result-view-collections").addEventListener(
  "click",
  () => runUiAction("activate", () => showProfileScreen("collections")),
);
requiredElement<HTMLButtonElement>(
  "#result-view-achievements",
).addEventListener("click", () =>
  runUiAction("activate", () => showProfileScreen("achievements")),
);
requiredElement<HTMLButtonElement>("#collections-back").addEventListener(
  "click",
  () => runUiAction("cancel", returnFromProfileScreen),
);
requiredElement<HTMLButtonElement>("#achievements-back").addEventListener(
  "click",
  () => runUiAction("cancel", returnFromProfileScreen),
);
requiredElement<HTMLButtonElement>("#settings-back").addEventListener(
  "click",
  () => runUiAction("cancel", returnFromSettings),
);

soundVolume.addEventListener("input", () => {
  const volume = Number(soundVolume.value);
  soundVolumeValue.value = `${Math.round(volume * 100)}%`;
  soundVolumeValue.textContent = soundVolumeValue.value;
});

requiredElement<HTMLButtonElement>(
  "#restore-default-settings",
).addEventListener("click", () => {
  runUiAction("confirm", () => {
    const defaults = createDefaultSettings();
    renderSettings(defaults);
    bindingCapture.replaceBindings(defaults.bindings);
    settingsBindingPrompt.textContent =
      "Defaults restored in this form. Save settings to keep them.";
    setSettingsStatus(
      "Defaults restored in this form. Save settings to keep them.",
    );
  });
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-remap-action]",
)) {
  button.addEventListener("click", () => {
    const action = button.dataset.remapAction;
    if (isInputAction(action)) {
      runUiAction("activate", () => beginBindingCapture(action));
    }
  });
}

for (const input of Object.values(bindingInputs)) {
  input.addEventListener("input", () => {
    bindingCapture.replaceBindings({
      togglePause: bindingTogglePause.value,
      dismissTutorial: bindingDismissTutorial.value,
      purchaseCurrentEncounter: bindingPurchase.value,
      useCarriedItem: bindingUseItem.value,
    });
  });
}

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  primeSound();
  let settings: BrowserSettings;
  try {
    settings = readSettingsForm();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    setSettingsStatus(
      message.includes("multiple actions")
        ? `Settings could not be saved. ${message}.`
        : "Settings could not be saved. Check each binding and the volume.",
      message.includes("multiple actions")
        ? "binding-conflict"
        : "invalid-record",
    );
    renderSettings(currentSettings);
    soundEffects.presentUiAction("cancel");
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
      renderSettings(currentSettings);
      soundEffects.presentUiAction("cancel");
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
      renderSettings(currentSettings);
      soundEffects.presentUiAction("cancel");
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
    renderSettings(currentSettings);
    soundEffects.presentUiAction("cancel");
    return;
  }
  currentSettings = settingsSave.settings;
  soundEffects.setPreferences(currentSettings.sound);
  keyboardRouter.replaceBindings(currentSettings.bindings);
  bindingCapture.replaceBindings(currentSettings.bindings);
  renderSettings(currentSettings);
  renderKeyboardHints(currentSettings.bindings);
  settingsBindingPrompt.textContent =
    "Choose Remap, then press a supported key. Press Escape to cancel.";
  gameStatus.dataset.settingsStatus = "loaded";
  delete gameStatus.dataset.settingsError;
  setSettingsStatus("Settings saved.");
  soundEffects.presentUiAction("confirm");
});

document.addEventListener("visibilitychange", () => {
  const visible = document.visibilityState === "visible";
  activeRun?.clock?.setVisible(visible);
  soundEffects.setVisible(visible);
});
window.addEventListener("pagehide", () => {
  activeRun?.clock?.stop();
  soundEffects.setVisible(false);
});
window.addEventListener("pageshow", () => {
  const visible = document.visibilityState === "visible";
  activeRun?.clock?.setVisible(visible);
  activeRun?.clock?.start();
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

startRun(currentProfile, { focus: false, startImmediately: true });
