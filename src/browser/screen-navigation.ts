import { createProfileOverviewView } from "../application/profile.js";
import type {
  ProfileOverviewView,
  ProfileState,
} from "../application/contracts.js";
import { profileExperienceThreshold } from "../domain/profile.js";

export type ScreenId =
  "title" | "gameplay" | "result" | "collections" | "settings" | "credits";

export interface ScreenNavigationElements {
  readonly screens: Readonly<Record<ScreenId, HTMLElement>>;
  readonly titleCreditsButton: HTMLButtonElement;
  readonly profileSummary: HTMLElement;
  readonly titleProfileSummary: HTMLElement;
  readonly weaponCollection: HTMLUListElement;
  readonly armorCollection: HTMLUListElement;
  readonly collectionProgress: HTMLElement;
  readonly playerStatusLevel: HTMLElement;
  readonly playerStatusXp: HTMLElement;
  readonly playerStatusXpFill: HTMLElement;
  readonly equipmentPreview: HTMLElement;
  readonly playerStatusChallenges: HTMLUListElement;
  readonly playerStatusProgress: HTMLElement;
}

export interface ScreenNavigationOptions {
  readonly readProfile: () => Readonly<ProfileState>;
  readonly onLeaveGameplay: () => void;
  readonly beforeShowTitle: () => void;
  readonly prepareSettings: () => void;
  readonly renderSettings: () => void;
}

export interface ScreenNavigation {
  current(): ScreenId;
  show(screen: ScreenId, focus?: boolean): void;
  showTitle(): void;
  showProfileScreen(): void;
  showSettings(): void;
  returnFromProfileScreen(): void;
  returnFromSettings(): void;
  returnFromCredits(): void;
  updateProfileSummary(profile: Readonly<ProfileState>): void;
  renderProfileScreens(profile: Readonly<ProfileState>): void;
}

function profileSummaryText(view: ProfileOverviewView): string {
  return (
    `Level ${view.level} · XP ${view.xp} · ` +
    `Multiplier ${view.scoreMultiplier} · High score ${view.highScore} · ` +
    `Collections ${view.collections.totalDiscovered}/${view.collections.total} · ` +
    `Achievements ${view.achievements.filter(({ unlocked }) => unlocked).length}/5`
  );
}

function achievementLabel(
  id: ProfileOverviewView["achievements"][number]["id"],
): string {
  switch (id) {
    case "slay-a-dragon":
      return "Slay a Dragon";
    case "stashed-3000-gold":
      return "Stashed 3000 Gold";
    case "reach-day-10":
      return "Reach Day #10";
    case "get-all-collection":
      return "Get all Collection";
    case "perform-70000-damage":
      return "Perform 70000+ Damage";
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
      button.title = `Lv${entry.tier} - ${entry.name}`;
      button.textContent = entry.discovered ? "■" : "□";
      item.append(
        button,
        document.createTextNode(` Tier ${entry.tier}: ${entry.name}`),
      );
      return item;
    }),
  );
}

function renderPlayerStatus(
  elements: ScreenNavigationElements,
  view: Readonly<ProfileOverviewView>,
): void {
  elements.equipmentPreview.dataset.state = "empty";
  elements.playerStatusLevel.textContent = `Level ${view.level} (x${view.scoreMultiplier} Score)`;
  const xpThreshold = profileExperienceThreshold(view.level);
  elements.playerStatusXp.textContent = `${view.xp}/${xpThreshold} EXP`;
  elements.playerStatusXpFill.style.width = `${Math.min(100, (view.xp / xpThreshold) * 100)}%`;
  elements.playerStatusProgress.textContent = `Game Progress - ${Math.round(view.progress.totalPoints)}%`;
  elements.playerStatusChallenges.replaceChildren(
    ...view.achievements.map((achievement) => {
      const item = document.createElement("li");
      item.dataset.unlocked = String(achievement.unlocked);
      item.setAttribute(
        "aria-label",
        `${achievementLabel(achievement.id)}, ${achievement.unlocked ? "Unlocked" : "Locked"}`,
      );
      item.textContent = achievementLabel(achievement.id);
      return item;
    }),
  );
}

function showEquipmentPreview(
  equipmentPreview: HTMLElement,
  target: EventTarget | null,
): void {
  if (!(target instanceof HTMLButtonElement)) return;
  const name = target.dataset.equipmentName;
  const tier = target.dataset.equipmentTier;
  if (name === undefined || tier === undefined) return;
  equipmentPreview.dataset.state = "selected";
  equipmentPreview.textContent = `Lv${tier} - ${name}`;
}

/** Owns browser screen visibility, menu return paths, and profile views. */
export function createScreenNavigation(
  elements: ScreenNavigationElements,
  options: ScreenNavigationOptions,
): ScreenNavigation {
  let currentScreen: ScreenId = "gameplay";
  let profileReturnScreen: "title" | "result" = "title";
  let settingsReturnScreen: "title" | "result" = "title";

  for (const list of [elements.weaponCollection, elements.armorCollection]) {
    list.addEventListener("pointerover", (event) => {
      showEquipmentPreview(elements.equipmentPreview, event.target);
    });
    list.addEventListener("focusin", (event) => {
      showEquipmentPreview(elements.equipmentPreview, event.target);
    });
    list.addEventListener("click", (event) => {
      showEquipmentPreview(elements.equipmentPreview, event.target);
    });
  }

  const updateProfileSummary = (profile: Readonly<ProfileState>): void => {
    const summary = profileSummaryText(createProfileOverviewView(profile));
    elements.profileSummary.textContent = summary;
    elements.titleProfileSummary.textContent = summary;
  };

  const renderProfileScreens = (profile: Readonly<ProfileState>): void => {
    const view = createProfileOverviewView(profile);
    renderEquipmentList(elements.weaponCollection, view.collections.weapons);
    renderEquipmentList(elements.armorCollection, view.collections.armor);
    renderPlayerStatus(elements, view);
    elements.collectionProgress.textContent =
      `${view.collections.totalDiscovered}/${view.collections.total} equipment discoveries · ` +
      `${view.progress.collectionPoints} collection points`;
  };

  const show = (screen: ScreenId, focus = true): void => {
    if (currentScreen === "gameplay" && screen !== "gameplay") {
      options.onLeaveGameplay();
    }
    for (const [id, element] of Object.entries(elements.screens) as [
      ScreenId,
      HTMLElement,
    ][]) {
      element.hidden = id !== screen;
    }
    currentScreen = screen;
    if (focus) elements.screens[screen].focus();
  };

  return Object.freeze({
    current: () => currentScreen,
    show,
    showTitle(): void {
      options.beforeShowTitle();
      const profile = options.readProfile();
      updateProfileSummary(profile);
      renderProfileScreens(profile);
      options.renderSettings();
      show("title");
    },
    showProfileScreen(): void {
      profileReturnScreen = currentScreen === "result" ? "result" : "title";
      renderProfileScreens(options.readProfile());
      show("collections");
    },
    showSettings(): void {
      settingsReturnScreen = currentScreen === "result" ? "result" : "title";
      options.prepareSettings();
      show("settings");
    },
    returnFromProfileScreen(): void {
      show(profileReturnScreen);
    },
    returnFromSettings(): void {
      options.prepareSettings();
      show(settingsReturnScreen);
    },
    returnFromCredits(): void {
      show("title", false);
      elements.titleCreditsButton.focus();
    },
    updateProfileSummary,
    renderProfileScreens,
  });
}
