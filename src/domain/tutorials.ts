import type {
  GameEvent,
  RunState,
  TutorialPage,
  TutorialPreference,
  TutorialState,
} from "./contracts.js";

export interface TutorialRules {
  readonly shopActionMinimumX: number;
  readonly shopActionMaximumX: number;
  readonly lifespanThreshold: {
    readonly whole: number;
    readonly fraction: number;
  };
  readonly hpThresholdNumerator: number;
  readonly hpThresholdDenominator: number;
}

export interface TutorialStepResult {
  readonly state: RunState;
  readonly page: TutorialPage | null;
}

/** Creates the hidden once-per-run tutorial progress for a new run. */
export function createTutorialState(
  preference: TutorialPreference,
): TutorialState {
  return Object.freeze({
    preference,
    page1Shown: false,
    page2Shown: false,
    page3Shown: false,
    page4Shown: false,
    page5Shown: false,
  });
}

function markPageShown(
  tutorials: Readonly<TutorialState>,
  page: Exclude<TutorialPage, 0>,
): TutorialState {
  switch (page) {
    case 1:
      return Object.freeze({ ...tutorials, page1Shown: true });
    case 2:
      return Object.freeze({ ...tutorials, page2Shown: true });
    case 3:
      return Object.freeze({ ...tutorials, page3Shown: true });
    case 4:
      return Object.freeze({ ...tutorials, page4Shown: true });
    case 5:
      return Object.freeze({ ...tutorials, page5Shown: true });
  }
}

function isAtOrBelowLifespanThreshold(
  state: Readonly<RunState>,
  rules: Readonly<TutorialRules>,
): boolean {
  if (state.lifespan.whole < rules.lifespanThreshold.whole) {
    return true;
  }
  if (state.lifespan.whole > rules.lifespanThreshold.whole) {
    return false;
  }
  return state.lifespan.fraction <= rules.lifespanThreshold.fraction;
}

function isAtOrBelowHpThreshold(
  state: Readonly<RunState>,
  rules: Readonly<TutorialRules>,
): boolean {
  return (
    state.player.hp.current * rules.hpThresholdDenominator <=
    state.player.hp.maximum * rules.hpThresholdNumerator
  );
}

function hasPromotedBattle(events: readonly GameEvent[]): boolean {
  return events.some(
    (event) =>
      event.type === "encounter-promoted" && event.encounter.kind === "battle",
  );
}

function hasActiveCombatUpdate(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
): boolean {
  return (
    stepped.activeTicks > previous.activeTicks &&
    previous.lifecycle.phase === "battling" &&
    stepped.lifecycle.phase === "battling" &&
    stepped.battle !== null &&
    stepped.battle.enemy.phase !== "dead" &&
    stepped.battle.hero.phase !== "dead"
  );
}

function chooseTutorialPage(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  events: readonly GameEvent[],
  rules: Readonly<TutorialRules>,
): Exclude<TutorialPage, 0> | null {
  const tutorials = stepped.tutorials;
  const activeTickConsumed = stepped.activeTicks > previous.activeTicks;
  const current = stepped.encounters.current;

  if (
    !tutorials.page1Shown &&
    activeTickConsumed &&
    current?.kind === "shop" &&
    !current.used &&
    current.x > rules.shopActionMinimumX &&
    current.x < rules.shopActionMaximumX
  ) {
    return 1;
  }

  if (
    !tutorials.page2Shown &&
    activeTickConsumed &&
    current?.kind === "shop" &&
    current.shop === "soul-shrine" &&
    !current.used &&
    current.x > rules.shopActionMinimumX &&
    current.x < rules.shopActionMaximumX
  ) {
    return 2;
  }

  if (!tutorials.page3Shown && hasPromotedBattle(events)) {
    return 3;
  }

  if (
    !tutorials.page4Shown &&
    activeTickConsumed &&
    isAtOrBelowLifespanThreshold(stepped, rules) &&
    stepped.lifecycle.phase !== "ended"
  ) {
    return 4;
  }

  if (
    !tutorials.page5Shown &&
    hasActiveCombatUpdate(previous, stepped) &&
    isAtOrBelowHpThreshold(stepped, rules)
  ) {
    return 5;
  }

  return null;
}

/** Opens at most one contextual tutorial after one authoritative opportunity. */
export function advanceTutorialGates(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  events: readonly GameEvent[],
  rules: Readonly<TutorialRules>,
): TutorialStepResult {
  if (
    stepped.lifecycle.phase === "ended" ||
    stepped.lifecycle.tutorialPage !== null ||
    stepped.tutorials.preference === "disabled"
  ) {
    return Object.freeze({ state: stepped, page: null });
  }

  const page = chooseTutorialPage(previous, stepped, events, rules);
  if (page === null) {
    return Object.freeze({ state: stepped, page: null });
  }

  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      tutorials: markPageShown(stepped.tutorials, page),
      lifecycle: Object.freeze({
        ...stepped.lifecycle,
        tutorialPage: page,
      }),
    }),
    page,
  });
}
