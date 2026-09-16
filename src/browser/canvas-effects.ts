import type { GameEvent, PresentationFrame } from "../application/contracts.js";
import type { WorldPoint } from "./canvas-drawing.js";

export interface EffectRecord {
  readonly event: GameEvent;
  readonly key: string;
  readonly startActiveTicks: number;
  readonly anchor: WorldPoint;
  readonly clickAnchor: WorldPoint | undefined;
  readonly message: string | undefined;
}

export const NO_VISUAL_EFFECTS: readonly EffectRecord[] = Object.freeze([]);

const MOUSE_EFFECT_LIFETIME = 60;
const ORIGINAL_ACTION_EFFECT_LIFETIME = 30;

const VISUAL_EFFECT_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "achievement-unlocked",
  "battle-reward",
  "combat-hit",
  "combat-lethal-hit",
  "equipment-discovered",
  "item-use-rejected",
  "item-used",
  "lifespan-death",
  "purchase-rejected",
  "run-ended",
  "shop-departed",
  "shop-purchased",
]);

export function isVisualEffectEvent(event: GameEvent): boolean {
  return VISUAL_EFFECT_EVENT_TYPES.has(event.type);
}

/** Visual lifetimes are presentation choices measured in public active ticks. */
export function effectLifetime(event: GameEvent): number {
  switch (event.type) {
    case "combat-hit":
      return 8;
    case "combat-lethal-hit":
      return 8;
    case "combat-phase-changed":
      return 1;
    case "battle-started":
    case "encounter-promoted":
      return 14;
    case "shop-purchased":
      return ORIGINAL_ACTION_EFFECT_LIFETIME;
    case "item-used":
      return ORIGINAL_ACTION_EFFECT_LIFETIME;
    case "battle-reward":
    case "equipment-discovered":
    case "achievement-unlocked":
      return 20;
    case "purchase-rejected":
    case "item-use-rejected":
      return 10;
    case "shop-departed":
      return 12;
    case "lifespan-death":
    case "run-ended":
      return 20;
    case "pause-toggled":
    case "tutorial-dismissed":
      return 12;
    case "step-advanced":
      return 0;
  }
}

function effectRetentionLifetime(effect: Readonly<EffectRecord>): number {
  return Math.max(
    effectLifetime(effect.event),
    effect.clickAnchor === undefined ? 0 : MOUSE_EFFECT_LIFETIME,
  );
}

export function effectAge(
  frame: Readonly<PresentationFrame>,
  effect: Readonly<EffectRecord>,
): number {
  const activeTickAge = Math.max(
    0,
    frame.current.activeTicks - effect.startActiveTicks,
  );
  return (
    activeTickAge + (frame.current.lifecycle.paused ? 0 : frame.interpolation)
  );
}

export function clickEffectAge(
  frame: Readonly<PresentationFrame>,
  effect: Readonly<EffectRecord>,
): number {
  const age = effectAge(frame, effect);
  if (frame.current.activeTicks !== effect.startActiveTicks) return age;
  return Math.max(
    0,
    age - (frame.current.lifecycle.paused ? 0 : frame.interpolation),
  );
}

export function sameEventList(
  previous: readonly GameEvent[],
  current: readonly GameEvent[],
): boolean {
  if (previous.length !== current.length) return false;
  return current.every((event, index) => previous[index] === event);
}

/** Owns retained event effects without owning Canvas drawing or resource loads. */
export class CanvasEffectTracker {
  #activeEffects: readonly EffectRecord[] = NO_VISUAL_EFFECTS;
  #effectHistory = new Map<string, EffectRecord>();
  #seenEffectKeys = new Set<string>();
  #registeredEffectEvents = new Set<GameEvent>();
  #effectSequence = 0;
  #lastFrameStep: number | undefined;

  get activeEffects(): readonly EffectRecord[] {
    return this.#activeEffects;
  }

  get sequence(): number {
    return this.#effectSequence;
  }

  register(
    frame: Readonly<PresentationFrame>,
    createRecord: (event: GameEvent, key: string) => EffectRecord,
  ): void {
    if (
      this.#lastFrameStep !== undefined &&
      frame.current.steps < this.#lastFrameStep
    ) {
      this.#effectHistory.clear();
      this.#seenEffectKeys.clear();
      this.#registeredEffectEvents.clear();
      this.#effectSequence = 0;
    }

    frame.events.forEach((event, index) => {
      if (!isVisualEffectEvent(event)) return;
      if (this.#registeredEffectEvents.has(event)) return;
      this.#registeredEffectEvents.add(event);
      const key = `${frame.current.steps}:${index}:${describeEvent(event)}`;
      if (this.#seenEffectKeys.has(key)) return;
      this.#seenEffectKeys.add(key);
      this.#effectSequence += 1;
      this.#effectHistory.set(key, createRecord(event, key));
    });

    this.#lastFrameStep = frame.current.steps;
  }

  prune(frame: Readonly<PresentationFrame>): void {
    const active: EffectRecord[] = [];
    for (const [key, effect] of this.#effectHistory) {
      if (effectAge(frame, effect) <= effectRetentionLifetime(effect)) {
        active.push(effect);
      } else {
        this.#effectHistory.delete(key);
      }
    }
    this.#activeEffects = Object.freeze(active);
  }

  latestMessage(
    frame: Readonly<PresentationFrame>,
  ): Readonly<EffectRecord> | undefined {
    for (let index = this.#activeEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.#activeEffects[index];
      if (
        effect?.message !== undefined &&
        effectAge(frame, effect) <= effectLifetime(effect.event)
      ) {
        return effect;
      }
    }
    return undefined;
  }
}

function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case "achievement-unlocked":
      return `${event.type}:${event.achievement}`;
    case "combat-phase-changed":
      return `${event.type}:${event.actor}:${event.phase}`;
    case "combat-hit":
      return `${event.type}:${event.attacker}:${event.damage}`;
    case "combat-lethal-hit":
      return `${event.type}:${event.target}`;
    case "battle-reward":
      return `${event.type}:${event.enemy}:${event.gold}`;
    case "battle-started":
      return event.type;
    case "encounter-promoted":
      return `${event.type}:${event.encounter.kind}`;
    case "equipment-discovered":
      return `${event.type}:${event.equipment}:${event.tier}`;
    case "lifespan-death":
      return event.type;
    case "pause-toggled":
      return `${event.type}:${String(event.paused)}`;
    case "purchase-rejected":
      return `${event.type}:${event.reason}`;
    case "item-used":
      return `${event.type}:${event.item}`;
    case "item-use-rejected":
      return `${event.type}:${event.reason}`;
    case "step-advanced":
      return `${event.type}:${event.step}`;
    case "shop-departed":
      return `${event.type}:${event.shop}`;
    case "shop-purchased":
      return `${event.type}:${event.shop}:${event.price}`;
    case "tutorial-dismissed":
      return `${event.type}:${event.page}`;
    case "run-ended":
      return `${event.type}:${event.reason}`;
  }
}
