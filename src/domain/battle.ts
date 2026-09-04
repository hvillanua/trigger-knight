import type {
  BattleObservation,
  BattleState,
  CombatActorState,
  GameEvent,
  ObservedBattleEnemy,
  RunState,
} from "./contracts.js";

export interface BattleRules {
  readonly heroInitialX: number;
  readonly initialAttackDelay: number;
  readonly initialAttackFactor: number;
  readonly initialAttackCount: number;
  readonly initialAlpha: number;
  readonly speedDecayPerActiveTick: number;
}

export interface BattleLifecycleStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

function createCombatActor(
  x: number,
  rules: Readonly<BattleRules>,
): CombatActorState {
  return Object.freeze({
    phase: "idle",
    x,
    attackDelay: rules.initialAttackDelay,
    attackFactor: rules.initialAttackFactor,
    attackCount: rules.initialAttackCount,
    alpha: rules.initialAlpha,
  });
}

export function createBattleState(battle: Readonly<BattleState>): BattleState {
  return Object.freeze({
    enemyHp: battle.enemyHp,
    hero: Object.freeze({ ...battle.hero }),
    enemy: Object.freeze({ ...battle.enemy }),
  });
}

function createInitialBattleState(
  enemyX: number,
  enemyHp: number,
  rules: Readonly<BattleRules>,
): BattleState {
  return Object.freeze({
    enemyHp,
    hero: createCombatActor(rules.heroInitialX, rules),
    enemy: createCombatActor(enemyX, rules),
  });
}

function observeBattleEnemy(
  state: Readonly<RunState>,
  battle: Readonly<BattleState>,
): ObservedBattleEnemy {
  const current = state.encounters.current;
  if (current?.kind !== "battle") {
    throw new Error("Battle state requires a current battle encounter");
  }

  return Object.freeze({
    id: current.enemy.id,
    maximumHp: current.enemy.maximumHp,
    currentHp: battle.enemyHp,
  });
}

/** Projects only mechanic-bearing battle values into the player boundary. */
export function observeBattle(
  state: Readonly<RunState>,
): BattleObservation | null {
  if (state.battle === null) {
    return null;
  }

  return Object.freeze({
    enemy: observeBattleEnemy(state, state.battle),
    actors: Object.freeze({
      hero: Object.freeze({
        phase: state.battle.hero.phase,
        x: state.battle.hero.x,
      }),
      enemy: Object.freeze({
        phase: state.battle.enemy.phase,
        x: state.battle.enemy.x,
      }),
    }),
  });
}

/** Starts battles and decays the running speed while combat is active. */
export function advanceBattleLifecycle(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<BattleRules>,
): BattleLifecycleStepResult {
  if (stepped.lifecycle.phase !== "battling") {
    return Object.freeze({ state: stepped, events: Object.freeze([]) });
  }

  if (stepped.battle === null) {
    const current = stepped.encounters.current;
    if (current?.kind !== "battle") {
      throw new Error("Battling state requires a current battle encounter");
    }

    const battle = createInitialBattleState(
      current.x,
      current.enemy.maximumHp,
      rules,
    );
    const enemy = observeBattleEnemy(
      Object.freeze({ ...stepped, battle }),
      battle,
    );

    return Object.freeze({
      state: Object.freeze({
        ...stepped,
        battle,
      }),
      events: Object.freeze([Object.freeze({ type: "battle-started", enemy })]),
    });
  }

  if (
    previous.activeTicks === stepped.activeTicks ||
    previous.lifecycle.phase !== "battling"
  ) {
    return Object.freeze({
      state: Object.freeze({
        ...stepped,
        battle: createBattleState(stepped.battle),
      }),
      events: Object.freeze([]),
    });
  }

  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      movementSpeed: Math.max(
        0,
        stepped.movementSpeed - rules.speedDecayPerActiveTick,
      ),
      battle: createBattleState(stepped.battle),
    }),
    events: Object.freeze([]),
  });
}
