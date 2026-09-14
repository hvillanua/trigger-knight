import type {
  CombatActorPhase,
  EnemyId,
  GameObservation,
} from "../application/contracts.js";

export type ActorSpriteId = "hero" | EnemyId;
export type ActorVisualPhase = CombatActorPhase | "running";
type Clip = readonly [first: number, last: number];

// Pose ranges derived by inspecting the staged PNGs. One frame per active tick
// is a presentation choice, not a recovered Flash timeline. Death uses a fade
// of the final hurt pose because these exports have no separate death sequence.
function clips(idle: Clip, move: Clip, attack: Clip, flinch: Clip) {
  return Object.freeze({
    idle,
    running: move,
    move,
    attack,
    flinch,
    dead: [flinch[1], flinch[1]] as Clip,
  });
}
export const ACTOR_CLIPS = Object.freeze({
  hero: clips([1, 16], [17, 33], [34, 55], [56, 62]),
  dragon: clips([1, 12], [13, 24], [25, 46], [47, 53]),
  goblin: clips([1, 13], [14, 25], [26, 39], [47, 53]),
  golem: clips([1, 17], [18, 29], [30, 50], [51, 57]),
  // Wolf 42–48 contain Hero artwork; Goblin 40–46 contain only a shadow.
  wolf: clips([1, 8], [9, 26], [27, 41], [49, 55]),
});

export function actorFrameNumber(
  id: ActorSpriteId,
  phase: ActorVisualPhase,
  ticks: number,
): number {
  const [first, last] = ACTOR_CLIPS[id][phase];
  const offset = Math.max(0, Math.floor(ticks));
  const loop = phase === "idle" || phase === "move" || phase === "running";
  return (
    first +
    (loop ? offset % (last - first + 1) : Math.min(offset, last - first))
  );
}

export interface ActorPose {
  readonly id: ActorSpriteId;
  readonly phase: ActorVisualPhase;
  readonly frame: number;
  readonly alpha: number;
}

/** Animation history uses only the public active-tick clock and actor phases. */
export class ActorAnimation {
  #previous: Readonly<GameObservation> | undefined;
  #heroStart = 0;
  #enemyStart = 0;
  #returnX = 50;
  #returnDistance = 0;
  hero: ActorPose = { id: "hero", phase: "running", frame: 17, alpha: 1 };
  enemy: ActorPose | undefined;

  /** Records a public transition before a display render can be coalesced. */
  presentTransition(
    previous: Readonly<GameObservation>,
    current: Readonly<GameObservation>,
  ): void {
    const prior = this.#previous ?? previous;
    const reset = this.#previous === undefined || current.steps < prior.steps;
    if (reset) {
      this.#heroStart = current.activeTicks;
      this.#enemyStart = current.activeTicks;
      this.#returnX = 50;
      this.#returnDistance = current.distance;
    }
    if (!reset && previous.battle !== null && current.battle === null) {
      this.#returnX = previous.battle.actors.hero.x;
      this.#returnDistance = previous.distance;
    }

    const previousHeroPhase = this.#heroPhase(previous);
    const currentHeroPhase = this.#heroPhase(current);
    if (currentHeroPhase !== previousHeroPhase) {
      this.#heroStart = current.activeTicks;
    }

    const previousEnemy = this.#enemyIdentity(previous);
    const currentEnemy = this.#enemyIdentity(current);
    if (
      currentEnemy !== undefined &&
      (previousEnemy === undefined ||
        previousEnemy.id !== currentEnemy.id ||
        previousEnemy.phase !== currentEnemy.phase ||
        (previous.battle === null && current.battle !== null))
    ) {
      this.#enemyStart = current.activeTicks;
    }

    this.#previous = current;
  }

  runningX(distance: number): number {
    return Math.max(
      50,
      this.#returnX - Math.max(0, distance - this.#returnDistance),
    );
  }

  present(current: Readonly<GameObservation>): void {
    const previous = this.#previous;
    if (previous === undefined) {
      this.#heroStart = current.activeTicks;
      this.#enemyStart = current.activeTicks;
      this.#returnX = 50;
      this.#returnDistance = current.distance;
      this.#previous = current;
    } else if (current !== previous) {
      this.presentTransition(previous, current);
    }
    this.#updatePose(current);
  }

  #pose(id: ActorSpriteId, phase: ActorVisualPhase, age: number): ActorPose {
    const normalizedAge = Math.max(0, age);
    return {
      id,
      phase,
      frame: actorFrameNumber(id, phase, normalizedAge),
      alpha: phase === "dead" ? Math.max(0, 1 - normalizedAge / 12) : 1,
    };
  }

  #heroPhase(current: Readonly<GameObservation>): ActorVisualPhase {
    return (
      current.battle?.actors.hero.phase ??
      (current.lifecycle.phase === "ended" ? "dead" : "running")
    );
  }

  #enemyIdentity(
    current: Readonly<GameObservation>,
  ): { readonly id: EnemyId; readonly phase: CombatActorPhase } | undefined {
    const id =
      current.battle?.enemy.id ??
      (current.encounters.current?.kind === "battle"
        ? current.encounters.current.enemy.id
        : undefined);
    if (id === undefined) return undefined;
    return {
      id,
      phase: current.battle?.actors.enemy.phase ?? "idle",
    };
  }

  #updatePose(current: Readonly<GameObservation>): void {
    const heroPhase = this.#heroPhase(current);
    this.hero = this.#pose(
      "hero",
      heroPhase,
      current.activeTicks - this.#heroStart,
    );
    const enemy = this.#enemyIdentity(current);
    this.enemy =
      enemy === undefined
        ? undefined
        : this.#pose(
            enemy.id,
            enemy.phase,
            current.activeTicks - this.#enemyStart,
          );
  }
}
