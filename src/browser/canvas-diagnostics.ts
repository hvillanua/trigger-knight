import type {
  GameEvent,
  GameObservation,
  PresentationFrame,
} from "../application/contracts.js";
import { describeGameEvent } from "./hud.js";
import { actionPointerImageId } from "./canvas-drawing.js";
import type { AssetTreatment } from "./asset-treatment.js";
import type { VisualAtlasStatus } from "./visual-atlas.js";

function formatProjectionValue(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

export function describeEvent(event: GameEvent): string {
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

type VisualKeyValue = string | number | boolean | null;

function encodeVisualKeyValue(value: VisualKeyValue): string {
  if (value === null) return "null";
  const text = String(value);
  return `${text.length}:${text}`;
}

function visualObservationSignature(
  observation: Readonly<GameObservation>,
): string {
  const battle = observation.battle;
  const encounter = observation.encounters.current;
  const battleValues: readonly VisualKeyValue[] =
    battle === null
      ? [null]
      : [
          battle.enemy.id,
          battle.enemy.currentHp,
          battle.enemy.maximumHp,
          battle.actors.hero.phase,
          battle.actors.hero.x,
          battle.actors.enemy.phase,
          battle.actors.enemy.x,
        ];
  const encounterValues: readonly VisualKeyValue[] =
    encounter === null
      ? [null]
      : encounter.kind === "shop"
        ? ["shop", encounter.shop, encounter.x, encounter.used]
        : ["battle", encounter.enemy.id, encounter.x];
  return [
    observation.camera.x,
    observation.camera.y,
    observation.camera.width,
    observation.camera.height,
    observation.distance,
    observation.day,
    observation.lifecycle.phase,
    observation.lifecycle.paused,
    observation.lifecycle.tutorialPage,
    observation.lifespan.whole,
    observation.lifespan.fraction,
    observation.player.hp.current,
    observation.player.hp.maximum,
    observation.player.gold,
    observation.player.weapon.name,
    observation.player.weapon.tier,
    observation.player.armor.name,
    observation.player.armor.tier,
    observation.player.inventory.item,
    observation.score,
    observation.actions.canPurchaseCurrentEncounter,
    observation.actions.canUseCarriedItem,
    ...battleValues,
    ...encounterValues,
  ]
    .map(encodeVisualKeyValue)
    .join("|");
}

/** Identifies the public visual inputs that can require a Canvas redraw. */
export function visualFrameSignature(
  frame: Readonly<PresentationFrame>,
  effectKeys: readonly string[],
  atlasStatus: VisualAtlasStatus,
): string {
  const previous = visualObservationSignature(frame.previous);
  const current = visualObservationSignature(frame.current);
  return JSON.stringify([
    frame.current.activeTicks,
    actionPointerImageId(frame.current) === "pointer" ? 0 : 1,
    previous,
    current,
    previous === current ? null : frame.interpolation,
    effectKeys,
    atlasStatus,
  ]);
}

/** Keeps test-facing Canvas data attributes cheap without dropping consumers. */
export class CanvasDiagnostics {
  readonly #canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
  }

  initialize(
    assetStatus: VisualAtlasStatus,
    fontStatus: "loading" | "ready" | "fallback",
    treatment: AssetTreatment,
  ): void {
    this.#set("renderer", "canvas-2d");
    this.#set(
      "visualVersion",
      treatment.directory === undefined
        ? "original-assets-v1"
        : `${treatment.id}-assets-v1`,
    );
    this.#set(
      "assetSource",
      treatment.directory === undefined
        ? "original-runtime-assets"
        : `${treatment.id}-runtime-assets`,
    );
    this.#set("fontStatus", fontStatus);
    this.setAssetStatus(assetStatus);
    this.setReducedMotion(false);
  }

  setAssetStatus(status: VisualAtlasStatus): void {
    this.#set("assetStatus", status);
    this.#set("spriteMode", status === "ready" ? "atlas" : "missing");
  }

  setFontStatus(status: "loading" | "ready" | "fallback"): void {
    this.#set("fontStatus", status);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.#set("reducedMotion", String(reducedMotion));
  }

  updateFrame(
    frame: Readonly<PresentationFrame>,
    visibleEffectTypes: readonly GameEvent["type"][],
    effectSequence: number,
    assetStatus: VisualAtlasStatus,
  ): void {
    const current = frame.current;
    this.setAssetStatus(assetStatus);
    this.#set("observationStep", String(current.steps));
    this.#set("events", frame.events.map(describeEvent).join(","));
    this.#set(
      "eventAnnouncement",
      frame.events.map(describeGameEvent).filter(Boolean).join(" "),
    );
    this.#set(
      "visualScene",
      current.battle
        ? "battle"
        : current.lifecycle.phase === "ended"
          ? "ended"
          : current.encounters.current?.kind === "battle"
            ? "approaching-battle"
            : "running",
    );
    this.#set("movementSpeed", String(current.movementSpeed));
    this.#set("distance", String(current.distance));
    this.#set("day", String(current.day));
    this.#set("score", String(current.score));
    this.#set("phase", current.lifecycle.phase);
    this.#set(
      "purchaseEligible",
      String(current.actions.canPurchaseCurrentEncounter),
    );
    this.#set("itemEligible", String(current.actions.canUseCarriedItem));
    this.#set("activeEffects", visibleEffectTypes.join(","));
    this.#set("effectSequence", String(effectSequence));
    const encounter = current.encounters.current;
    this.#set(
      "renderedSprites",
      [
        "hero",
        current.player.weapon.tier > 0 ? "weapon" : "",
        current.player.armor.tier > 0 ? "armor" : "",
        current.player.inventory.item ?? "",
        current.battle?.enemy.id ??
          (encounter?.kind === "battle" ? encounter.enemy.id : ""),
        encounter?.kind === "shop" ? encounter.shop : "",
      ]
        .filter(Boolean)
        .join(","),
    );

    if (encounter?.kind === "shop") {
      this.#set("currentShop", encounter.shop);
      this.#set("currentEncounterX", String(encounter.x));
    } else {
      this.#delete("currentShop");
      this.#delete("currentEncounterX");
    }
    if (encounter?.kind === "battle" && current.battle === null) {
      this.#set("approachingEnemy", encounter.enemy.id);
    } else {
      this.#delete("approachingEnemy");
    }

    const tutorialPage = current.lifecycle.tutorialPage;
    if (tutorialPage === null) {
      this.#delete("tutorialPage");
    } else {
      this.#set("tutorialPage", String(tutorialPage));
    }

    const battle = current.battle;
    if (battle === null) {
      this.#delete("battleEnemy");
      this.#delete("battleEnemyHp");
      this.#delete("battleHeroPhase");
      this.#delete("battleEnemyPhase");
    } else {
      this.#set("battleEnemy", battle.enemy.id);
      this.#set(
        "battleEnemyHp",
        `${battle.enemy.currentHp}/${battle.enemy.maximumHp}`,
      );
      this.#set("battleHeroPhase", battle.actors.hero.phase);
      this.#set("battleEnemyPhase", battle.actors.enemy.phase);
    }
  }

  updateProjection(
    camera: Readonly<GameObservation["camera"]>,
    viewport: Readonly<{ x: number; y: number; width: number; height: number }>,
    interpolation: number,
  ): void {
    this.#set(
      "worldCamera",
      [camera.x, camera.y, camera.width, camera.height]
        .map(formatProjectionValue)
        .join(","),
    );
    this.#set(
      "projectionViewport",
      [viewport.x, viewport.y, viewport.width, viewport.height]
        .map(formatProjectionValue)
        .join(","),
    );
    this.#set("interpolation", String(interpolation));
  }

  setInterpolatedDistance(distance: number): void {
    this.#set("interpolatedDistance", String(distance));
  }

  #set(name: string, value: string): void {
    if (this.#canvas.dataset[name] === value) return;
    this.#canvas.dataset[name] = value;
  }

  #delete(name: string): void {
    if (this.#canvas.dataset[name] === undefined) return;
    delete this.#canvas.dataset[name];
  }
}
