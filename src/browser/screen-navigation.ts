import { createProfileOverviewView } from "../application/profile.js";
import type {
  ProfileOverviewView,
  ProfileState,
} from "../application/contracts.js";

export type ScreenId =
  "title" | "gameplay" | "result" | "collections" | "achievements" | "settings";

export interface ScreenNavigationElements {
  readonly screens: Readonly<Record<ScreenId, HTMLElement>>;
  readonly profileSummary: HTMLElement;
  readonly titleProfileSummary: HTMLElement;
  readonly weaponCollection: HTMLUListElement;
  readonly armorCollection: HTMLUListElement;
  readonly collectionProgress: HTMLElement;
  readonly playerStatusLevel: HTMLElement;
  readonly playerStatusXp: HTMLElement;
  readonly equipmentPreview: HTMLElement;
  readonly playerStatusChallenges: HTMLUListElement;
  readonly playerStatusProgress: HTMLElement;
  readonly achievementList: HTMLUListElement;
  readonly achievementProgress: HTMLElement;
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
  showProfileScreen(screen: "collections" | "achievements"): void;
  showSettings(): void;
  returnFromProfileScreen(): void;
  returnFromSettings(): void;
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

function renderPlayerStatus(
  elements: ScreenNavigationElements,
  view: Readonly<ProfileOverviewView>,
): void {
  elements.equipmentPreview.dataset.state = "empty";
  elements.playerStatusLevel.textContent = `Level ${view.level} (x${view.scoreMultiplier} Score)`;
  elements.playerStatusXp.textContent = `${view.xp} XP`;
  elements.playerStatusProgress.textContent = `Game Progress - ${Math.round((view.collections.totalDiscovered / view.collections.total) * 100)}%`;
  elements.playerStatusChallenges.replaceChildren(
    ...view.achievements.map((achievement) => {
      const item = document.createElement("li");
      item.dataset.unlocked = String(achievement.unlocked);
      item.textContent = `${achievementLabel(achievement.id)} ${achievement.unlocked ? "■" : "□"}`;
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
  const discovered = target.dataset.discovered === "true";
  if (name === undefined || tier === undefined) return;
  equipmentPreview.dataset.state = "selected";
  equipmentPreview.textContent = discovered
    ? `${name}, tier ${tier}. This equipment is available in future runs.`
    : `${name}, tier ${tier}. This equipment has not been discovered yet.`;
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
    elements.achievementList.replaceChildren(
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
    elements.achievementProgress.textContent =
      `${view.achievements.filter(({ unlocked }) => unlocked).length}/5 achievements unlocked · ` +
      `${view.progress.achievementPoints} achievement points · ` +
      `${view.progress.totalPoints} total points`;
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
    showProfileScreen(screen: "collections" | "achievements"): void {
      profileReturnScreen = currentScreen === "result" ? "result" : "title";
      renderProfileScreens(options.readProfile());
      show(screen);
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
    updateProfileSummary,
    renderProfileScreens,
  });
}
