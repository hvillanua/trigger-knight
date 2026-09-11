import type {
  GameEvent,
  GameObservation,
  PresentationFrame,
  PresentationPort,
} from "../application/contracts.js";
import { describeGameEvent, enemyName, shopName } from "./hud.js";
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

function tutorialLabel(page: number): string {
  switch (page) {
    case 0:
      return "Basic survival";
    case 1:
      return "Building interaction";
    case 2:
      return "Soul Shrine";
    case 3:
      return "Automatic battle and item use";
    case 4:
      return "Low lifespan";
    case 5:
      return "Low HP";
    default:
      return `Page ${page}`;
  }
}

function interpolate(
  previous: number,
  current: number,
  amount: number,
): number {
  return previous + (current - previous) * amount;
}

function sameCurrentEncounter(
  previous: Readonly<GameObservation["encounters"]["current"]>,
  current: Readonly<GameObservation["encounters"]["current"]>,
): boolean {
  if (previous === null || current === null || previous.kind !== current.kind) {
    return false;
  }
  if (current.kind === "shop" && previous.kind === "shop") {
    return previous.shop === current.shop;
  }
  if (current.kind === "battle" && previous.kind === "battle") {
    return previous.enemy.id === current.enemy.id;
  }
  return false;
}

function currentEncounterX(frame: Readonly<PresentationFrame>): number | null {
  const current = frame.current.encounters.current;
  if (current === null) return null;
  const previous = frame.previous.encounters.current;
  if (!sameCurrentEncounter(previous, current)) return current.x;
  if (previous === null) return current.x;
  return interpolate(previous.x, current.x, frame.interpolation);
}

function battleActorX(
  frame: Readonly<PresentationFrame>,
  actor: "hero" | "enemy",
): number | null {
  const current = frame.current.battle;
  if (current === null) return null;
  const previous = frame.previous.battle;
  if (
    previous === null ||
    previous.enemy.id !== current.enemy.id ||
    previous.actors[actor] === undefined
  ) {
    return current.actors[actor].x;
  }
  return interpolate(
    previous.actors[actor].x,
    current.actors[actor].x,
    frame.interpolation,
  );
}

function drawBackground(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
): void {
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

  context.fillStyle = "#263557";
  for (let x = camera.x - 40; x < camera.x + camera.width + 40; x += 80) {
    const peak = camera.y + 150 + ((Math.floor(x) / 80) % 2) * 12;
    context.beginPath();
    context.moveTo(x, peak + 42);
    context.lineTo(x + 42, peak);
    context.lineTo(x + 84, peak + 42);
    context.closePath();
    context.fill();
  }

  const groundY = camera.y + camera.height * 0.73;
  context.fillStyle = "#101a2b";
  context.fillRect(camera.x, groundY, camera.width, camera.height * 0.27);
  context.strokeStyle = "#806d3f";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(camera.x, groundY);
  context.lineTo(camera.x + camera.width, groundY);
  context.stroke();
}

function drawHero(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  phase: string,
): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = "#f4d58d";
  context.beginPath();
  context.arc(0, -28, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#5478b7";
  context.fillRect(-12, -18, 24, 30);
  context.fillStyle = "#bac6df";
  context.fillRect(8, -12, 20, 4);
  context.strokeStyle = "#f7f1df";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-8, 12);
  context.lineTo(-12, 28);
  context.moveTo(8, 12);
  context.lineTo(12, 28);
  context.stroke();
  context.fillStyle = "#f7f1df";
  context.font = "600 10px system-ui";
  context.textAlign = "center";
  context.fillText(phase, 0, 46);
  context.restore();
}

function drawEnemy(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy: string,
  phase: string,
): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = enemy === "Dragon" ? "#a9506e" : "#8f6d5a";
  context.beginPath();
  context.arc(0, -20, enemy === "Dragon" ? 22 : 16, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d9e2f5";
  context.fillRect(-10, -25, 5, 5);
  context.fillRect(5, -25, 5, 5);
  context.fillStyle = "#f7f1df";
  context.font = "600 10px system-ui";
  context.textAlign = "center";
  context.fillText(`${enemy} · ${phase}`, 0, 30);
  context.restore();
}

function drawShop(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  shop: string,
  available: boolean,
): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = available ? "#806d3f" : "#4a5060";
  context.fillRect(-28, -58, 56, 58);
  context.fillStyle = available ? "#f4d58d" : "#8994ae";
  context.beginPath();
  context.moveTo(-34, -58);
  context.lineTo(0, -78);
  context.lineTo(34, -58);
  context.closePath();
  context.fill();
  context.fillStyle = "#080b14";
  context.fillRect(-8, -30, 16, 30);
  context.fillStyle = "#f7f1df";
  context.font = "600 9px system-ui";
  context.textAlign = "center";
  context.fillText(shop, 0, 14);
  if (!available) {
    context.strokeStyle = "#ffb4a8";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-18, -70);
    context.lineTo(18, -34);
    context.moveTo(18, -70);
    context.lineTo(-18, -34);
    context.stroke();
  }
  context.restore();
}

function drawWorld(
  context: CanvasRenderingContext2D,
  frame: PresentationFrame,
): void {
  const camera = frame.current.camera;
  drawBackground(context, camera);
  const groundY = camera.y + camera.height * 0.73;
  const battle = frame.current.battle;
  if (battle === null) {
    drawHero(context, camera.x + camera.width * 0.2, groundY, "running");
  } else {
    const heroX = battleActorX(frame, "hero") ?? camera.x + 100;
    const enemyX = battleActorX(frame, "enemy") ?? camera.x + 400;
    drawHero(context, heroX, groundY, battle.actors.hero.phase);
    drawEnemy(
      context,
      enemyX,
      groundY,
      enemyName(battle.enemy.id),
      battle.actors.enemy.phase,
    );
  }

  const current = frame.current.encounters.current;
  const x = currentEncounterX(frame);
  if (current !== null && x !== null) {
    if (current.kind === "shop") {
      drawShop(
        context,
        x,
        groundY,
        shopName(current.shop),
        frame.current.actions.canPurchaseCurrentEncounter,
      );
    } else if (battle === null) {
      context.fillStyle = "#a9506e";
      context.beginPath();
      context.arc(x, groundY - 30, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f7f1df";
      context.font = "600 10px system-ui";
      context.textAlign = "center";
      context.fillText("Battle", x, groundY + 14);
    }
  }

  const markerOffset =
    ((frame.current.distance % camera.width) + camera.width) % camera.width;
  context.fillStyle = "#f4d58d";
  context.fillRect(camera.x + markerOffset, camera.y + camera.height - 8, 2, 8);
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
    this.#canvas.dataset.eventAnnouncement = frame.events
      .map(describeGameEvent)
      .filter(Boolean)
      .join(" ");
    this.#canvas.dataset.movementSpeed = String(frame.current.movementSpeed);
    this.#canvas.dataset.distance = String(frame.current.distance);
    this.#canvas.dataset.day = String(frame.current.day);
    this.#canvas.dataset.score = String(frame.current.score);
    this.#canvas.dataset.phase = frame.current.lifecycle.phase;
    this.#canvas.dataset.purchaseEligible = String(
      frame.current.actions.canPurchaseCurrentEncounter,
    );
    this.#canvas.dataset.itemEligible = String(
      frame.current.actions.canUseCarriedItem,
    );
    const current = frame.current.encounters.current;
    if (current?.kind === "shop") {
      this.#canvas.dataset.currentShop = current.shop;
      this.#canvas.dataset.currentEncounterX = String(current.x);
    } else {
      delete this.#canvas.dataset.currentShop;
      delete this.#canvas.dataset.currentEncounterX;
    }
    const tutorialPage = frame.current.lifecycle.tutorialPage;
    if (tutorialPage === null) {
      delete this.#canvas.dataset.tutorialPage;
    } else {
      this.#canvas.dataset.tutorialPage = String(tutorialPage);
    }
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
    drawWorld(context, this.#frame);

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
      `Step ${this.#frame.current.steps} · Day ${this.#frame.current.day}`,
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

    const tutorialPage = this.#frame.current.lifecycle.tutorialPage;
    if (tutorialPage !== null) {
      context.fillStyle = "#f4d58d";
      context.fillText(
        `Tutorial ${tutorialPage}: ${tutorialLabel(tutorialPage)}`,
        centerX,
        centerY + titleSize * 2.5,
      );
    }

    const eventDescription = this.#frame.events
      .map(describeGameEvent)
      .filter(Boolean)
      .join(" ");
    if (eventDescription !== "") {
      context.fillStyle = "#f4d58d";
      context.fillText(eventDescription, centerX, centerY + titleSize * 2);
    }

    context.restore();
  }
}
