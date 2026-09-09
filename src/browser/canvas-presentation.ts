import type {
  GameEvent,
  PresentationFrame,
  PresentationPort,
} from "../application/contracts.js";
import {
  calculateBackingStoreSize,
  calculateWorldProjection,
  type CssDimensions,
} from "./foundation.js";

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

function formatProjectionValue(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function interpolate(
  previous: number,
  current: number,
  amount: number,
): number {
  return previous + (current - previous) * amount;
}

/** Canvas 2D adapter for public gameplay observations and events. */
export class CanvasPresentation implements PresentationPort {
  readonly #canvas: HTMLCanvasElement;
  #frame: PresentationFrame | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#canvas.dataset.renderer = "canvas-2d";
  }

  present(frame: PresentationFrame): void {
    this.#frame = frame;
    this.#canvas.dataset.observationStep = String(frame.current.steps);
    this.#canvas.dataset.events = frame.events.map(describeEvent).join(",");
    this.#canvas.dataset.movementSpeed = String(frame.current.movementSpeed);
    this.#canvas.dataset.distance = String(frame.current.distance);
    this.#canvas.dataset.day = String(frame.current.day);
    this.#canvas.dataset.score = String(frame.current.score);
    this.#canvas.dataset.phase = frame.current.lifecycle.phase;
    const battle = frame.current.battle;
    if (battle === null) {
      delete this.#canvas.dataset.battleEnemy;
      delete this.#canvas.dataset.battleEnemyHp;
      delete this.#canvas.dataset.battleHeroPhase;
      delete this.#canvas.dataset.battleEnemyPhase;
    } else {
      this.#canvas.dataset.battleEnemy = battle.enemy.id;
      this.#canvas.dataset.battleEnemyHp = `${battle.enemy.currentHp}/${battle.enemy.maximumHp}`;
      this.#canvas.dataset.battleHeroPhase = battle.actors.hero.phase;
      this.#canvas.dataset.battleEnemyPhase = battle.actors.enemy.phase;
    }
    this.#draw();
  }

  resize(cssDimensions: CssDimensions, devicePixelRatio: number): void {
    const backingStore = calculateBackingStoreSize(
      cssDimensions,
      devicePixelRatio,
    );
    this.#canvas.width = backingStore.width;
    this.#canvas.height = backingStore.height;
    this.#draw();
  }

  #draw(): void {
    const context = this.#canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D is unavailable");
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#05070d";
    context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

    if (this.#frame === undefined) {
      return;
    }

    const camera = this.#frame.current.camera;
    const projection = calculateWorldProjection(camera, {
      width: this.#canvas.width,
      height: this.#canvas.height,
    });
    const { viewport } = projection;
    this.#canvas.dataset.worldCamera = [
      camera.x,
      camera.y,
      camera.width,
      camera.height,
    ]
      .map(formatProjectionValue)
      .join(",");
    this.#canvas.dataset.projectionViewport = [
      viewport.x,
      viewport.y,
      viewport.width,
      viewport.height,
    ]
      .map(formatProjectionValue)
      .join(",");
    this.#canvas.dataset.interpolation = String(this.#frame.interpolation);

    context.save();
    context.beginPath();
    context.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    context.clip();
    context.translate(viewport.x, viewport.y);
    context.scale(projection.scale, projection.scale);
    context.translate(-camera.x, -camera.y);

    const gradient = context.createLinearGradient(
      camera.x,
      camera.y,
      camera.x,
      camera.y + camera.height,
    );
    gradient.addColorStop(0, "#18213b");
    gradient.addColorStop(1, "#080b14");
    context.fillStyle = gradient;
    context.fillRect(camera.x, camera.y, camera.width, camera.height);

    const centerX = camera.x + camera.width / 2;
    const centerY = camera.y + camera.height / 2;
    const titleSize = 24;
    context.fillStyle = "#f4d58d";
    context.font = `600 ${titleSize}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Trigger Knight", centerX, centerY - titleSize / 2);

    context.fillStyle = "#bac6df";
    context.font = "500 12px system-ui";
    context.fillText(
      `Step ${this.#frame.current.steps}`,
      centerX,
      centerY + titleSize,
    );

    const interpolatedDistance = interpolate(
      this.#frame.previous.distance,
      this.#frame.current.distance,
      this.#frame.interpolation,
    );
    this.#canvas.dataset.interpolatedDistance = String(interpolatedDistance);
    context.fillText(
      `Distance ${formatProjectionValue(this.#frame.current.distance)}`,
      centerX,
      centerY + titleSize * 1.5,
    );

    const markerOffset =
      ((interpolatedDistance % camera.width) + camera.width) % camera.width;
    context.fillStyle = "#f4d58d";
    context.fillRect(
      camera.x + markerOffset,
      camera.y + camera.height - 8,
      2,
      8,
    );

    const eventDescription = this.#frame.events.map(describeEvent).join(", ");
    if (eventDescription !== "") {
      context.fillText(eventDescription, centerX, centerY + titleSize * 2);
    }

    context.restore();
  }
}
