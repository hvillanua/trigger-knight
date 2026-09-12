import type {
  CombatActorPhase,
  EnemyId,
  GameEvent,
  GameObservation,
  PresentationFrame,
  PresentationPort,
  ShopId,
} from "../application/contracts.js";
import {
  describeGameEvent,
  enemyName,
  itemName,
  shopDescription,
  shopName,
} from "./hud.js";
import {
  createVisualAtlas,
  VISUAL_SPRITES,
  type SpriteRect,
  type VisualAtlas,
  type VisualAtlasStatus,
  type VisualSpriteId,
} from "./visual-atlas.js";
import {
  calculateBackingStoreSize,
  calculateWorldProjection,
  type CssDimensions,
} from "./foundation.js";

type DisplayActorPhase = CombatActorPhase | "running";

interface SpriteOptions {
  readonly scale?: number;
  readonly alpha?: number;
  readonly flipX?: boolean;
}

interface EffectRecord {
  readonly event: GameEvent;
  readonly key: string;
}

interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

const GROUND_RATIO = 0.73;
const HERO_RUNNING_X = 96;
const EFFECT_BANNER_HEIGHT = 28;

const SHOP_PRODUCTS: Readonly<Record<ShopId, VisualSpriteId>> = Object.freeze({
  bladesmith: "weapon",
  armorsmith: "armor",
  "soul-shrine": "soul-shrine",
  pharmacy: "elixir",
  "grims-shop": "divine-edge",
  "voucher-store": "gold-voucher",
});

const ENEMY_SPRITES: Readonly<Record<EnemyId, VisualSpriteId>> = Object.freeze({
  goblin: "goblin",
  golem: "golem",
  wolf: "wolf",
  dragon: "dragon",
});

const SCENERY_SPRITES = Object.freeze(["tree", "pine", "rock"] as const);

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

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatLifespan(
  lifespan: Readonly<{ whole: number; fraction: number }>,
): string {
  return `${lifespan.whole}.${String(lifespan.fraction).padStart(2, "0")}%`;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(
  previous: number,
  current: number,
  amount: number,
): number {
  return previous + (current - previous) * amount;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
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

function imageReady(
  image: HTMLImageElement | undefined,
): image is HTMLImageElement {
  return image !== undefined && image.complete && image.naturalWidth > 0;
}

function spriteReady(atlas: VisualAtlas, sprite: SpriteRect): boolean {
  return (
    atlas.status === "ready" &&
    imageReady(atlas.image) &&
    sprite.width > 0 &&
    sprite.height > 0
  );
}

function drawAtlasSprite(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  spriteId: VisualSpriteId,
  x: number,
  baselineY: number,
  options: SpriteOptions = {},
): boolean {
  const sprite = VISUAL_SPRITES[spriteId];
  const scale = options.scale ?? 1;
  const alpha = options.alpha ?? 1;
  const originalImage = atlas.originalImages[spriteId];
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, baselineY);
  if (options.flipX === true) context.scale(-1, 1);
  try {
    if (imageReady(originalImage)) {
      const fitScale = Math.min(
        (sprite.width * scale) / originalImage.naturalWidth,
        (sprite.height * scale) / originalImage.naturalHeight,
      );
      const width = originalImage.naturalWidth * fitScale;
      const height = originalImage.naturalHeight * fitScale;
      context.drawImage(originalImage, -width / 2, -height, width, height);
      context.restore();
      return true;
    }

    if (!spriteReady(atlas, sprite) || atlas.image === undefined) {
      context.restore();
      return false;
    }
    context.drawImage(
      atlas.image,
      sprite.x,
      sprite.y,
      sprite.width,
      sprite.height,
      (-sprite.width * scale) / 2,
      -sprite.height * scale,
      sprite.width * scale,
      sprite.height * scale,
    );
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
}

function drawShadow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void {
  context.save();
  context.fillStyle = "#05070d";
  context.globalAlpha = 0.55;
  context.beginPath();
  context.ellipse(x, y - 2, width, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMoonFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.fillStyle = "#ffe9a6";
  context.beginPath();
  context.arc(x, y - 48, 22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#18213b";
  context.beginPath();
  context.arc(x + 9, y - 56, 21, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCloudFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.fillStyle = "#8994ae";
  context.globalAlpha = 0.42;
  context.beginPath();
  context.ellipse(x - 18, y - 10, 23, 9, 0, 0, Math.PI * 2);
  context.ellipse(x + 8, y - 13, 25, 12, 0, 0, Math.PI * 2);
  context.ellipse(x + 30, y - 8, 17, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTreeFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  pine: boolean,
): void {
  context.save();
  context.fillStyle = "#5c382d";
  context.fillRect(x - 4, y - 42, 8, 42);
  context.fillStyle = pine ? "#315c54" : "#396b56";
  context.beginPath();
  if (pine) {
    context.moveTo(x, y - 92);
    context.lineTo(x - 30, y - 38);
    context.lineTo(x + 30, y - 38);
  } else {
    context.arc(x, y - 60, 30, 0, Math.PI * 2);
  }
  context.fill();
  context.restore();
}

function drawRockFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.fillStyle = "#7f899b";
  context.beginPath();
  context.moveTo(x - 28, y);
  context.lineTo(x - 18, y - 25);
  context.lineTo(x + 4, y - 39);
  context.lineTo(x + 27, y - 22);
  context.lineTo(x + 32, y);
  context.closePath();
  context.fill();
  context.fillStyle = "#aab3c0";
  context.beginPath();
  context.moveTo(x - 18, y - 25);
  context.lineTo(x + 4, y - 39);
  context.lineTo(x + 11, y - 18);
  context.lineTo(x - 4, y - 10);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSceneImage(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  assetId: "sky" | "ground" | "mountains",
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const image = atlas.sceneImages[assetId];
  if (!imageReady(image)) return false;
  try {
    context.drawImage(image, x, y, width, height);
    return true;
  } catch {
    return false;
  }
}

function drawBackground(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  day: number,
  atlas: VisualAtlas,
): void {
  context.fillStyle = "#d9edf0";
  context.fillRect(camera.x, camera.y, camera.width, camera.height);
  const originalSky = drawSceneImage(
    context,
    atlas,
    "sky",
    camera.x,
    camera.y,
    960,
    320,
  );
  if (!originalSky) {
    const gradient = context.createLinearGradient(
      camera.x,
      camera.y,
      camera.x,
      camera.y + camera.height,
    );
    gradient.addColorStop(0, day % 2 === 0 ? "#202b4d" : "#18213b");
    gradient.addColorStop(0.62, "#10182e");
    gradient.addColorStop(1, "#080b14");
    context.fillStyle = gradient;
    context.fillRect(camera.x, camera.y, camera.width, camera.height);

    const stars = [
      [22, 34],
      [68, 72],
      [111, 28],
      [157, 54],
      [205, 22],
      [252, 75],
      [301, 42],
      [347, 86],
      [395, 30],
      [451, 64],
    ] as const;
    context.fillStyle = "#f7f1df";
    for (const [x, y] of stars) {
      context.globalAlpha = x % 2 === 0 ? 0.72 : 0.42;
      context.fillRect(camera.x + x, camera.y + y, 2, 2);
    }
    context.globalAlpha = 1;
  }

  const moonX = camera.x + camera.width - 58;
  const moonY = camera.y + 74;
  if (!drawAtlasSprite(context, atlas, "moon", moonX, moonY, { scale: 0.8 })) {
    drawMoonFallback(context, moonX, moonY);
  }

  const originalMountains = drawSceneImage(
    context,
    atlas,
    "mountains",
    camera.x,
    camera.y + 60,
    960,
    120,
  );
  if (!originalMountains) {
    context.fillStyle = "#263557";
    context.beginPath();
    context.moveTo(camera.x, camera.y + 188);
    for (let x = camera.x - 40; x <= camera.x + camera.width + 40; x += 52) {
      const peak = camera.y + 142 + ((Math.floor(x / 52) + day) % 3) * 11;
      context.lineTo(x + 26, peak);
      context.lineTo(x + 52, camera.y + 188);
    }
    context.lineTo(camera.x + camera.width, camera.y + 188);
    context.closePath();
    context.fill();
  }

  const groundY = camera.y + camera.height * GROUND_RATIO;
  const originalGround = drawSceneImage(
    context,
    atlas,
    "ground",
    camera.x,
    camera.y + 170,
    960,
    188,
  );
  if (!originalGround) {
    context.fillStyle = "#1e3c35";
    context.fillRect(camera.x, groundY, camera.width, camera.height * 0.08);
    context.fillStyle = "#111c2a";
    context.fillRect(
      camera.x,
      groundY + camera.height * 0.08,
      camera.width,
      camera.height * 0.19,
    );
    context.fillStyle = "#182536";
    context.fillRect(
      camera.x,
      groundY + camera.height * 0.12,
      camera.width,
      camera.height * 0.06,
    );
  }
  context.strokeStyle = "#806d3f";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(camera.x, groundY);
  context.lineTo(camera.x + camera.width, groundY);
  context.stroke();
}

function drawMovingBackground(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  distance: number,
  atlas: VisualAtlas,
): void {
  const groundY = camera.y + camera.height * GROUND_RATIO;
  for (const offset of [70, 290] as const) {
    const cloudX =
      camera.x +
      positiveModulo(offset - distance * 0.08, camera.width + 110) -
      55;
    if (
      !drawAtlasSprite(context, atlas, "cloud", cloudX, camera.y + 112, {
        scale: 0.95,
        alpha: 0.72,
      })
    ) {
      drawCloudFallback(context, cloudX, camera.y + 112);
    }
  }

  const sceneryWidth = camera.width + 128;
  for (let index = 0; index < 7; index += 1) {
    const spriteId = SCENERY_SPRITES[index % SCENERY_SPRITES.length]!;
    const x =
      camera.x +
      positiveModulo(index * 97 + 34 - distance * 0.18, sceneryWidth) -
      64;
    const baseline = groundY + (index % 2 === 0 ? 4 : 10);
    const drawn = drawAtlasSprite(context, atlas, spriteId, x, baseline, {
      scale: index % 2 === 0 ? 0.78 : 0.62,
      alpha: 0.82,
    });
    if (!drawn && spriteId === "rock") drawRockFallback(context, x, baseline);
    if (!drawn && (spriteId === "tree" || spriteId === "pine")) {
      drawTreeFallback(context, x, baseline, spriteId === "pine");
    }
  }

  context.strokeStyle = "#526486";
  context.lineWidth = 1;
  for (let index = -1; index < 8; index += 1) {
    const x =
      camera.x +
      positiveModulo(index * 72 - distance * 0.55, camera.width + 72) -
      36;
    context.beginPath();
    context.moveTo(x, groundY + camera.height * 0.15);
    context.lineTo(x + 30, groundY + camera.height * 0.15);
    context.stroke();
  }
}

function drawPhaseBadge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  phase: DisplayActorPhase,
  color: string,
): void {
  context.save();
  context.fillStyle = "#080b14";
  context.globalAlpha = 0.85;
  context.fillRect(x - 29, y - 7, 58, 14);
  context.globalAlpha = 1;
  context.fillStyle = color;
  context.font = "600 9px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(phase.toUpperCase(), x, y);
  context.restore();
}

function drawHeroFallback(
  context: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  phase: DisplayActorPhase,
  weaponTier: number,
  armorTier: number,
): void {
  const bob = phase === "move" || phase === "running" ? -2 : 0;
  const color = phase === "flinch" ? "#ffb4a8" : "#5478b7";
  context.save();
  context.globalAlpha = phase === "dead" ? 0.48 : 1;
  context.translate(x, groundY + bob);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-15, -64);
  context.lineTo(-22, -16);
  context.lineTo(18, -16);
  context.lineTo(14, -64);
  context.closePath();
  context.fill();
  context.fillStyle = armorTier >= 7 ? "#aab3c0" : "#7e92ba";
  context.fillRect(-12, -49, 24, 31);
  context.fillStyle = "#f4d58d";
  context.beginPath();
  context.arc(0, -72, 12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = armorTier >= 5 ? "#bac6df" : "#5478b7";
  context.fillRect(-13, -82, 26, 8);
  context.fillStyle = "#080b14";
  context.fillRect(-7, -73, 4, 4);
  context.fillRect(4, -73, 4, 4);
  context.strokeStyle = "#f7f1df";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-8, -17);
  context.lineTo(-12, 3);
  context.moveTo(8, -17);
  context.lineTo(12, 3);
  context.stroke();
  context.strokeStyle = "#f4d58d";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(12, -43);
  context.lineTo(29 + weaponTier, -52);
  context.stroke();
  if (phase === "attack") {
    context.strokeStyle = "#ffe9a6";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(28, -46, 21, -1.1, 0.55);
    context.stroke();
  }
  if (phase === "flinch") {
    context.strokeStyle = "#ffb4a8";
    context.lineWidth = 2;
    context.strokeRect(-20, -88, 40, 78);
  }
  context.restore();
}

function drawHero(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  phase: DisplayActorPhase,
  weaponTier: number,
  armorTier: number,
): void {
  drawShadow(context, x, groundY, 22);
  const drawn = drawAtlasSprite(context, atlas, "hero", x, groundY, {
    alpha: phase === "dead" ? 0.5 : 1,
    scale: 1.08,
  });
  if (!drawn) {
    drawHeroFallback(context, x, groundY, phase, weaponTier, armorTier);
  } else if (phase === "attack") {
    context.save();
    context.strokeStyle = "#ffe9a6";
    context.lineWidth = 3;
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(x + 20, groundY - 47, 24, -1.2, 0.55);
    context.stroke();
    context.restore();
  } else if (phase === "flinch") {
    context.save();
    context.strokeStyle = "#ffb4a8";
    context.lineWidth = 3;
    context.strokeRect(x - 28, groundY - 91, 56, 78);
    context.restore();
  }
  drawPhaseBadge(
    context,
    x,
    groundY + 16,
    phase,
    phase === "flinch" ? "#ffb4a8" : "#f7f1df",
  );
  if (phase !== "dead") {
    const weaponX = x + 29 + Math.min(weaponTier, 10);
    context.save();
    context.strokeStyle = weaponTier >= 7 ? "#ffe9a6" : "#bac6df";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(weaponX - 8, groundY - 51);
    context.lineTo(weaponX + 9, groundY - 60);
    context.stroke();
    context.restore();
  }
}

function drawEnemyFallback(
  context: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  enemy: EnemyId,
  phase: CombatActorPhase,
): void {
  const flinching = phase === "flinch";
  const dead = phase === "dead";
  const offset = phase === "move" ? -3 : 0;
  context.save();
  context.translate(x, groundY + offset);
  context.globalAlpha = dead ? 0.42 : 1;
  if (enemy === "goblin") {
    context.fillStyle = flinching ? "#ffb4a8" : "#6e9b63";
    context.fillRect(-20, -53, 40, 38);
    context.beginPath();
    context.moveTo(-17, -52);
    context.lineTo(-26, -80);
    context.lineTo(-5, -65);
    context.lineTo(17, -52);
    context.lineTo(26, -80);
    context.lineTo(20, -44);
    context.closePath();
    context.fill();
  } else if (enemy === "golem") {
    context.fillStyle = flinching ? "#ffb4a8" : "#788594";
    context.fillRect(-27, -76, 54, 64);
    context.fillStyle = "#18213b";
    context.fillRect(-17, -62, 9, 9);
    context.fillRect(8, -62, 9, 9);
    context.fillStyle = "#586675";
    context.fillRect(-35, -60, 8, 35);
    context.fillRect(27, -60, 8, 35);
  } else if (enemy === "wolf") {
    context.fillStyle = flinching ? "#ffb4a8" : "#a87b5f";
    context.beginPath();
    context.ellipse(0, -34, 31, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(17, -48);
    context.lineTo(36, -75);
    context.lineTo(41, -42);
    context.closePath();
    context.fill();
    context.fillStyle = "#f4d58d";
    context.fillRect(30, -52, 5, 5);
  } else {
    context.fillStyle = flinching ? "#ffb4a8" : "#a9506e";
    context.beginPath();
    context.ellipse(0, -38, 27, 36, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d16a7e";
    context.beginPath();
    context.moveTo(-19, -50);
    context.lineTo(-48, -83);
    context.lineTo(-35, -31);
    context.closePath();
    context.moveTo(19, -50);
    context.lineTo(48, -83);
    context.lineTo(35, -31);
    context.closePath();
    context.fill();
    context.fillStyle = "#ffe9a6";
    context.fillRect(-12, -51, 7, 7);
    context.fillRect(6, -51, 7, 7);
  }
  if (phase === "attack") {
    context.strokeStyle = "#ffb4a8";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(-28, -38, 19, 1.1, 2.4);
    context.stroke();
  }
  context.restore();
}

function drawEnemy(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  enemy: EnemyId,
  phase: CombatActorPhase,
): void {
  drawShadow(context, x, groundY, enemy === "dragon" ? 30 : 23);
  const drawn = drawAtlasSprite(
    context,
    atlas,
    ENEMY_SPRITES[enemy],
    x,
    groundY,
    {
      alpha: phase === "dead" ? 0.45 : 1,
      scale: enemy === "dragon" ? 1.16 : 1.08,
      flipX: true,
    },
  );
  if (!drawn) drawEnemyFallback(context, x, groundY, enemy, phase);
  if (phase === "flinch") {
    context.save();
    context.strokeStyle = "#ffb4a8";
    context.lineWidth = 3;
    context.strokeRect(
      x - (enemy === "dragon" ? 38 : 29),
      groundY - (enemy === "dragon" ? 100 : 88),
      enemy === "dragon" ? 76 : 58,
      78,
    );
    context.restore();
  }
  drawPhaseBadge(
    context,
    x,
    groundY + 16,
    phase,
    phase === "flinch" ? "#ffb4a8" : "#f7f1df",
  );
}

function drawHealthBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  current: number,
  maximum: number,
): void {
  const ratio = maximum <= 0 ? 0 : clamp(current / maximum, 0, 1);
  context.save();
  context.fillStyle = "#080b14";
  context.fillRect(x - 42, y - 5, 84, 10);
  context.fillStyle =
    ratio > 0.5 ? "#82c99b" : ratio > 0.25 ? "#f4d58d" : "#e96d7a";
  context.fillRect(x - 39, y - 2, 78 * ratio, 4);
  context.strokeStyle = "#bac6df";
  context.lineWidth = 1;
  context.strokeRect(x - 42, y - 5, 84, 10);
  context.fillStyle = "#f7f1df";
  context.font = "600 8px system-ui";
  context.textAlign = "center";
  context.fillText(
    `${formatNumber(current)} / ${formatNumber(maximum)}`,
    x,
    y - 9,
  );
  context.restore();
}

function drawBuildingFallback(
  context: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  shop: ShopId,
): void {
  const colors: Readonly<Record<ShopId, string>> = {
    bladesmith: "#c28a49",
    armorsmith: "#8fa6ca",
    "soul-shrine": "#c097df",
    pharmacy: "#d77b70",
    "grims-shop": "#a9506e",
    "voucher-store": "#d3a747",
  };
  context.save();
  context.fillStyle = "#5c382d";
  context.fillRect(x - 28, groundY - 57, 56, 57);
  context.fillStyle = colors[shop];
  context.beginPath();
  context.moveTo(x - 34, groundY - 57);
  context.lineTo(x, groundY - 82);
  context.lineTo(x + 34, groundY - 57);
  context.closePath();
  context.fill();
  context.fillStyle = "#18213b";
  context.fillRect(x - 8, groundY - 30, 16, 30);
  context.restore();
}

function drawOriginalBuilding(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
): boolean {
  const image = atlas.sceneImages.building;
  if (!imageReady(image)) return false;
  const width = 124;
  const height = width * (image.naturalHeight / image.naturalWidth);
  try {
    context.drawImage(image, x - width / 2, groundY - height, width, height);
    return true;
  } catch {
    return false;
  }
}

function drawShop(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  shop: ShopId,
  available: boolean,
  used: boolean,
): void {
  drawShadow(context, x, groundY, 31);
  const drawn =
    drawOriginalBuilding(context, atlas, x, groundY) ||
    drawAtlasSprite(context, atlas, shop, x, groundY, {
      alpha: available ? 1 : 0.68,
      scale: 1.02,
    });
  if (!drawn) drawBuildingFallback(context, x, groundY, shop);

  const product = SHOP_PRODUCTS[shop];
  drawAtlasSprite(context, atlas, product, x + 24, groundY - 22, {
    scale: 0.32,
    alpha: available ? 1 : 0.6,
  });
  context.save();
  context.fillStyle = available ? "#f4d58d" : "#8994ae";
  context.font = "700 9px system-ui";
  context.textAlign = "center";
  context.fillText(shopName(shop), x, groundY + 13);
  context.fillStyle = "#bac6df";
  context.font = "500 8px system-ui";
  context.fillText(shopDescription(shop), x, groundY + 25);
  if (!available || used) {
    context.strokeStyle = used ? "#8994ae" : "#ffb4a8";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x - 20, groundY - 72);
    context.lineTo(x + 20, groundY - 35);
    context.moveTo(x + 20, groundY - 72);
    context.lineTo(x - 20, groundY - 35);
    context.stroke();
  }
  context.restore();
}

function drawApproachTrail(
  context: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  battle: boolean,
): void {
  context.save();
  context.strokeStyle = battle ? "#d16a7e" : "#f4d58d";
  context.globalAlpha = 0.35;
  context.lineWidth = 2;
  context.setLineDash([6, 7]);
  context.beginPath();
  context.moveTo(x, groundY + 3);
  context.lineTo(x - 72, groundY + 3);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawLoadout(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  observation: Readonly<GameObservation>,
  atlas: VisualAtlas,
): void {
  const left = camera.x + 10;
  const top = camera.y + 10;
  const width = camera.width - 20;
  context.save();
  context.fillStyle = "#080b14";
  context.globalAlpha = 0.86;
  context.fillRect(left, top, width, 34);
  context.globalAlpha = 1;
  context.strokeStyle = "#33415f";
  context.lineWidth = 1;
  context.strokeRect(left, top, width, 34);

  context.fillStyle = "#f4d58d";
  context.font = "700 10px system-ui";
  context.textAlign = "left";
  context.fillText("TRIGGER KNIGHT", left + 8, top + 13);
  context.fillStyle = "#bac6df";
  context.font = "500 9px system-ui";
  context.fillText(
    `${observation.lifecycle.phase === "battling" ? "BATTLE" : observation.lifecycle.phase.toUpperCase()} · DAY ${formatNumber(observation.day)}`,
    left + 8,
    top + 26,
  );

  const values = [
    `HP ${formatNumber(observation.player.hp.current)}/${formatNumber(observation.player.hp.maximum)}`,
    `LIFE ${formatLifespan(observation.lifespan)}`,
    `GOLD ${formatNumber(observation.player.gold)}`,
    `SCORE ${formatNumber(observation.score)}`,
  ];
  context.textAlign = "right";
  context.font = "600 9px system-ui";
  values.forEach((value, index) => {
    context.fillStyle = index === 1 ? "#ffb4a8" : "#f7f1df";
    context.fillText(value, left + width - 8 - index * 84, top + 14);
  });

  const item = observation.player.inventory.item;
  if (item !== null) {
    drawAtlasSprite(context, atlas, item, left + width - 18, top + 43, {
      scale: 0.34,
    });
  }
  context.textAlign = "right";
  context.fillStyle = "#bac6df";
  context.font = "500 8px system-ui";
  const itemLabel = item === null ? "NO ITEM" : itemName(item).toUpperCase();
  context.fillText(
    `${observation.player.weapon.name} T${observation.player.weapon.tier} · ${observation.player.armor.name} T${observation.player.armor.tier} · ${itemLabel}`,
    left + width - 30,
    top + 43,
  );
  context.restore();
}

function drawRouteMarker(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  y: number,
): void {
  if (!drawAtlasSprite(context, atlas, "road-marker", x, y, { scale: 0.34 })) {
    context.save();
    context.strokeStyle = "#f4d58d";
    context.lineWidth = 2;
    context.setLineDash([6, 7]);
    context.beginPath();
    context.moveTo(x, y - 14);
    context.lineTo(x, y);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}

function effectAnchor(
  frame: Readonly<PresentationFrame>,
  event: GameEvent,
): WorldPoint {
  const camera = frame.current.camera;
  const groundY = camera.y + camera.height * GROUND_RATIO;
  const heroX = battleActorX(frame, "hero") ?? camera.x + HERO_RUNNING_X;
  const enemyX = battleActorX(frame, "enemy") ?? camera.x + 390;
  const encounterX =
    currentEncounterX(frame) ??
    frame.previous.encounters.current?.x ??
    camera.x + HERO_RUNNING_X;

  switch (event.type) {
    case "combat-hit":
    case "combat-lethal-hit":
      return {
        x: event.target === "hero" ? heroX : enemyX,
        y: groundY - 53,
      };
    case "combat-phase-changed":
      return {
        x: event.actor === "hero" ? heroX : enemyX,
        y: groundY - 50,
      };
    case "battle-started":
      return { x: enemyX, y: groundY - 54 };
    case "encounter-promoted":
      return { x: encounterX, y: groundY - 40 };
    case "shop-purchased":
    case "purchase-rejected":
    case "shop-departed":
      return { x: encounterX, y: groundY - 50 };
    case "item-used":
    case "item-use-rejected":
      return { x: heroX, y: groundY - 55 };
    case "battle-reward":
    case "equipment-discovered":
    case "achievement-unlocked":
    case "lifespan-death":
    case "run-ended":
      return { x: heroX, y: groundY - 58 };
    case "pause-toggled":
    case "tutorial-dismissed":
    case "step-advanced":
      return { x: camera.x + camera.width / 2, y: camera.y + 108 };
  }
}

function isVisualEffectEvent(event: GameEvent): boolean {
  return event.type !== "step-advanced";
}

function sameEventList(
  previous: readonly GameEvent[],
  current: readonly GameEvent[],
): boolean {
  if (previous.length !== current.length) return false;
  return current.every((event, index) => previous[index] === event);
}

function visualObservationSignature(
  observation: Readonly<GameObservation>,
): readonly unknown[] {
  const battle = observation.battle;
  const encounter = observation.encounters.current;
  return [
    observation.camera.x,
    observation.camera.y,
    observation.camera.width,
    observation.camera.height,
    observation.distance,
    observation.day,
    observation.lifecycle.phase,
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
    battle === null
      ? null
      : [
          battle.enemy.id,
          battle.enemy.currentHp,
          battle.enemy.maximumHp,
          battle.actors.hero.phase,
          battle.actors.hero.x,
          battle.actors.enemy.phase,
          battle.actors.enemy.x,
        ],
    encounter === null
      ? null
      : encounter.kind === "shop"
        ? ["shop", encounter.shop, encounter.x, encounter.used]
        : ["battle", encounter.enemy.id, encounter.x],
  ];
}

function visualFrameSignature(
  frame: Readonly<PresentationFrame>,
  effects: readonly EffectRecord[],
  atlasStatus: VisualAtlasStatus,
): string {
  const previous = visualObservationSignature(frame.previous);
  const current = visualObservationSignature(frame.current);
  const previousKey = JSON.stringify(previous);
  const currentKey = JSON.stringify(current);
  return JSON.stringify([
    previousKey,
    currentKey,
    previousKey === currentKey ? null : frame.interpolation,
    effects.map(({ key }) => key),
    atlasStatus,
  ]);
}

function drawBurst(
  context: CanvasRenderingContext2D,
  point: WorldPoint,
  color: string,
  size: number,
): void {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.globalAlpha = 0.9;
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const inner = size * 0.35;
    const outer = size * (index % 2 === 0 ? 1 : 0.78);
    context.beginPath();
    context.moveTo(
      point.x + Math.cos(angle) * inner,
      point.y + Math.sin(angle) * inner,
    );
    context.lineTo(
      point.x + Math.cos(angle) * outer,
      point.y + Math.sin(angle) * outer,
    );
    context.stroke();
  }
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, size * 0.25, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  frame: Readonly<PresentationFrame>,
  effect: EffectRecord,
  index: number,
): void {
  const point = effectAnchor(frame, effect.event);
  switch (effect.event.type) {
    case "combat-hit":
      drawBurst(
        context,
        point,
        effect.event.critical ? "#ffe9a6" : "#f7f1df",
        effect.event.critical ? 24 : 17,
      );
      break;
    case "combat-lethal-hit":
      drawBurst(context, point, "#ffb4a8", 30);
      break;
    case "combat-phase-changed":
      context.save();
      context.strokeStyle =
        effect.event.phase === "attack" ? "#ffe9a6" : "#bac6df";
      context.lineWidth = 2;
      context.globalAlpha = 0.8;
      context.beginPath();
      context.arc(point.x, point.y, 22, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      break;
    case "battle-started":
    case "encounter-promoted":
      drawBurst(context, point, "#d16a7e", 25);
      break;
    case "shop-purchased":
    case "battle-reward":
      if (
        !drawAtlasSprite(
          context,
          atlas,
          "gold-voucher",
          point.x,
          point.y + 26,
          {
            scale: 0.42,
          },
        )
      ) {
        drawBurst(context, point, "#ffe9a6", 25);
      }
      break;
    case "item-used":
      if (
        !drawAtlasSprite(
          context,
          atlas,
          effect.event.item,
          point.x,
          point.y + 28,
          {
            scale: 0.45,
          },
        )
      ) {
        drawBurst(context, point, "#9ee0c6", 24);
      }
      break;
    case "purchase-rejected":
    case "item-use-rejected":
      drawBurst(context, point, "#ffb4a8", 20);
      break;
    case "shop-departed":
      context.save();
      context.strokeStyle = "#bac6df";
      context.globalAlpha = 0.7;
      context.lineWidth = 2;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(point.x - 32, point.y);
      context.lineTo(point.x + 32, point.y);
      context.stroke();
      context.setLineDash([]);
      context.restore();
      break;
    case "equipment-discovered":
      drawBurst(context, point, "#ffe9a6", 28);
      break;
    case "achievement-unlocked":
      if (
        !drawAtlasSprite(context, atlas, "spark", point.x, point.y + 28, {
          scale: 0.6,
        })
      ) {
        drawBurst(context, point, "#ffe9a6", 30);
      }
      break;
    case "lifespan-death":
    case "run-ended":
      context.save();
      context.fillStyle = "#a9506e";
      context.globalAlpha = 0.22;
      context.fillRect(
        frame.current.camera.x,
        frame.current.camera.y,
        frame.current.camera.width,
        frame.current.camera.height,
      );
      context.restore();
      break;
    case "pause-toggled":
      context.save();
      context.fillStyle = "#080b14";
      context.globalAlpha = 0.75;
      context.fillRect(
        frame.current.camera.x,
        frame.current.camera.y + 102,
        frame.current.camera.width,
        EFFECT_BANNER_HEIGHT,
      );
      context.globalAlpha = 1;
      context.fillStyle = "#f4d58d";
      context.font = "700 15px system-ui";
      context.textAlign = "center";
      context.fillText(
        effect.event.paused ? "RUN PAUSED" : "RUN RESUMED",
        frame.current.camera.x + frame.current.camera.width / 2,
        frame.current.camera.y + 121,
      );
      context.restore();
      break;
    case "tutorial-dismissed":
      context.save();
      context.fillStyle = "#bac6df";
      context.font = "600 10px system-ui";
      context.textAlign = "center";
      context.fillText(
        `Tutorial ${effect.event.page + 1}: ${tutorialLabel(effect.event.page)}`,
        frame.current.camera.x + frame.current.camera.width / 2,
        frame.current.camera.y + 122 + index * 12,
      );
      context.restore();
      break;
    case "step-advanced":
      break;
  }
}

function drawEffects(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  frame: Readonly<PresentationFrame>,
  effects: readonly EffectRecord[],
): void {
  effects.forEach((effect, index) =>
    drawEffect(context, atlas, frame, effect, index),
  );
}

function drawDynamicWorld(
  context: CanvasRenderingContext2D,
  frame: Readonly<PresentationFrame>,
  atlas: VisualAtlas,
  effects: readonly EffectRecord[],
): void {
  const camera = frame.current.camera;
  const groundY = camera.y + camera.height * GROUND_RATIO;
  const distance = interpolate(
    frame.previous.distance,
    frame.current.distance,
    frame.interpolation,
  );
  drawMovingBackground(context, camera, distance, atlas);
  const battle = frame.current.battle;
  if (battle === null) {
    drawHero(
      context,
      atlas,
      camera.x + HERO_RUNNING_X,
      groundY,
      "running",
      frame.current.player.weapon.tier,
      frame.current.player.armor.tier,
    );
  } else {
    const heroX = battleActorX(frame, "hero") ?? camera.x + HERO_RUNNING_X;
    const enemyX = battleActorX(frame, "enemy") ?? camera.x + 390;
    drawHero(
      context,
      atlas,
      heroX,
      groundY,
      battle.actors.hero.phase,
      frame.current.player.weapon.tier,
      frame.current.player.armor.tier,
    );
    drawEnemy(
      context,
      atlas,
      enemyX,
      groundY,
      battle.enemy.id,
      battle.actors.enemy.phase,
    );
    drawHealthBar(
      context,
      enemyX,
      groundY - 106,
      battle.enemy.currentHp,
      battle.enemy.maximumHp,
    );
  }

  const current = frame.current.encounters.current;
  const x = currentEncounterX(frame);
  if (current !== null && x !== null) {
    if (current.kind === "shop") {
      drawShop(
        context,
        atlas,
        x,
        groundY,
        current.shop,
        frame.current.actions.canPurchaseCurrentEncounter,
        current.used,
      );
      drawApproachTrail(context, x, groundY, false);
    } else if (battle === null) {
      drawEnemy(context, atlas, x, groundY, current.enemy.id, "idle");
      drawApproachTrail(context, x, groundY, true);
      context.save();
      context.fillStyle = "#f7f1df";
      context.font = "700 9px system-ui";
      context.textAlign = "center";
      context.fillText(
        `Approaching ${enemyName(current.enemy.id)}`,
        x,
        groundY + 28,
      );
      context.restore();
    }
  }
  const markerOffset = positiveModulo(distance, camera.width);
  drawRouteMarker(
    context,
    atlas,
    camera.x + markerOffset,
    camera.y + camera.height - 6,
  );
  drawEffects(context, atlas, frame, effects);
}

/** Canvas 2D adapter for public gameplay observations and events. */
export class CanvasPresentation implements PresentationPort {
  readonly #canvas: HTMLCanvasElement;
  #frame: PresentationFrame | undefined;
  #atlas: VisualAtlas;
  #activeEffects: readonly EffectRecord[] = Object.freeze([]);
  #seenEffectKeys = new Set<string>();
  #effectSequence = 0;
  #lastFrameStep: number | undefined;
  #lastDrawnVisualSignature: string | undefined;
  #backgroundLayer: HTMLCanvasElement | undefined;
  #backgroundLayerKey: string | undefined;
  #staticLayer: HTMLCanvasElement | undefined;
  #staticLayerKey: string | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#canvas.dataset.renderer = "canvas-2d";
    this.#canvas.dataset.visualVersion = "original-assets-v1";
    this.#canvas.dataset.assetSource = "original-runtime-assets";
    this.#atlas = createVisualAtlas((status) => {
      this.#canvas.dataset.assetStatus = status;
      this.#canvas.dataset.spriteMode =
        status === "ready" ? "atlas" : "fallback";
      this.#draw();
    });
    this.#canvas.dataset.assetStatus = this.#atlas.status;
    this.#canvas.dataset.spriteMode =
      this.#atlas.status === "ready" ? "atlas" : "fallback";
  }

  present(frame: PresentationFrame): void {
    const previousFrame = this.#frame;
    const redrawRequired =
      previousFrame === undefined ||
      previousFrame.previous !== frame.previous ||
      previousFrame.current !== frame.current ||
      previousFrame.interpolation !== frame.interpolation ||
      !sameEventList(previousFrame.events, frame.events);
    const normalizedFrame = Object.freeze({
      previous: frame.previous,
      current: frame.current,
      interpolation: Number.isFinite(frame.interpolation)
        ? clamp(frame.interpolation, 0, 1)
        : 1,
      events: Object.freeze([...frame.events]),
    });
    this.#frame = normalizedFrame;
    this.#registerEffects(normalizedFrame);
    const visualSignature = visualFrameSignature(
      normalizedFrame,
      this.#activeEffects,
      this.#atlas.status,
    );
    this.#canvas.dataset.assetStatus = this.#atlas.status;
    this.#canvas.dataset.spriteMode =
      this.#atlas.status === "ready" ? "atlas" : "fallback";
    this.#canvas.dataset.observationStep = String(frame.current.steps);
    this.#canvas.dataset.events = frame.events.map(describeEvent).join(",");
    this.#canvas.dataset.eventAnnouncement = frame.events
      .map(describeGameEvent)
      .filter(Boolean)
      .join(" ");
    this.#canvas.dataset.visualScene = frame.current.battle
      ? "battle"
      : frame.current.lifecycle.phase === "ended"
        ? "ended"
        : frame.current.encounters.current?.kind === "battle"
          ? "approaching-battle"
          : "running";
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
    this.#canvas.dataset.activeEffects = this.#activeEffects
      .map(({ event }) => event.type)
      .join(",");
    this.#canvas.dataset.effectSequence = String(this.#effectSequence);
    const current = frame.current.encounters.current;
    this.#canvas.dataset.renderedSprites = [
      "hero",
      frame.current.player.weapon.tier > 0 ? "weapon" : "",
      frame.current.player.armor.tier > 0 ? "armor" : "",
      frame.current.player.inventory.item ?? "",
      frame.current.battle?.enemy.id ??
        (current?.kind === "battle" ? current.enemy.id : ""),
      current?.kind === "shop" ? current.shop : "",
      current?.kind === "shop" ? SHOP_PRODUCTS[current.shop] : "",
      ...SCENERY_SPRITES,
    ]
      .filter(Boolean)
      .join(",");

    if (current?.kind === "shop") {
      this.#canvas.dataset.currentShop = current.shop;
      this.#canvas.dataset.currentEncounterX = String(current.x);
    } else {
      delete this.#canvas.dataset.currentShop;
      delete this.#canvas.dataset.currentEncounterX;
    }
    if (current?.kind === "battle" && frame.current.battle === null) {
      this.#canvas.dataset.approachingEnemy = current.enemy.id;
    } else {
      delete this.#canvas.dataset.approachingEnemy;
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
    if (redrawRequired && visualSignature !== this.#lastDrawnVisualSignature) {
      this.#draw();
    }
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

  #ensureStaticLayer(
    frame: Readonly<PresentationFrame>,
    projection: ReturnType<typeof calculateWorldProjection>,
  ): HTMLCanvasElement {
    const key = JSON.stringify([
      this.#canvas.width,
      this.#canvas.height,
      visualObservationSignature(frame.current),
      this.#atlas.status,
    ]);
    if (this.#staticLayer !== undefined && this.#staticLayerKey === key) {
      return this.#staticLayer;
    }

    const layer = this.#staticLayer ?? document.createElement("canvas");
    if (
      layer.width !== this.#canvas.width ||
      layer.height !== this.#canvas.height
    ) {
      layer.width = this.#canvas.width;
      layer.height = this.#canvas.height;
    }
    const context = layer.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D is unavailable for the static layer");
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, layer.width, layer.height);
    context.drawImage(this.#ensureBackgroundLayer(frame, projection), 0, 0);
    context.save();
    context.beginPath();
    context.rect(
      projection.viewport.x,
      projection.viewport.y,
      projection.viewport.width,
      projection.viewport.height,
    );
    context.clip();
    context.translate(projection.viewport.x, projection.viewport.y);
    context.scale(projection.scale, projection.scale);
    context.translate(-frame.current.camera.x, -frame.current.camera.y);
    drawLoadout(context, frame.current.camera, frame.current, this.#atlas);
    context.restore();

    this.#staticLayer = layer;
    this.#staticLayerKey = key;
    return layer;
  }

  #ensureBackgroundLayer(
    frame: Readonly<PresentationFrame>,
    projection: ReturnType<typeof calculateWorldProjection>,
  ): HTMLCanvasElement {
    const camera = frame.current.camera;
    const key = JSON.stringify([
      this.#canvas.width,
      this.#canvas.height,
      camera.x,
      camera.y,
      camera.width,
      camera.height,
      frame.current.day,
      this.#atlas.status,
    ]);
    if (
      this.#backgroundLayer !== undefined &&
      this.#backgroundLayerKey === key
    ) {
      return this.#backgroundLayer;
    }

    const layer = this.#backgroundLayer ?? document.createElement("canvas");
    if (
      layer.width !== this.#canvas.width ||
      layer.height !== this.#canvas.height
    ) {
      layer.width = this.#canvas.width;
      layer.height = this.#canvas.height;
    }
    const context = layer.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D is unavailable for the background layer");
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, layer.width, layer.height);
    context.save();
    context.beginPath();
    context.rect(
      projection.viewport.x,
      projection.viewport.y,
      projection.viewport.width,
      projection.viewport.height,
    );
    context.clip();
    context.translate(projection.viewport.x, projection.viewport.y);
    context.scale(projection.scale, projection.scale);
    context.translate(-camera.x, -camera.y);
    drawBackground(context, camera, frame.current.day, this.#atlas);
    context.restore();

    this.#backgroundLayer = layer;
    this.#backgroundLayerKey = key;
    return layer;
  }

  #registerEffects(frame: Readonly<PresentationFrame>): void {
    if (
      this.#lastFrameStep !== undefined &&
      frame.current.steps < this.#lastFrameStep
    ) {
      this.#seenEffectKeys.clear();
      this.#effectSequence = 0;
    }

    const active: EffectRecord[] = [];
    frame.events.forEach((event, index) => {
      if (!isVisualEffectEvent(event)) return;
      const key = `${frame.current.steps}:${index}:${describeEvent(event)}`;
      if (!this.#seenEffectKeys.has(key)) {
        this.#seenEffectKeys.add(key);
        this.#effectSequence += 1;
      }
      active.push(Object.freeze({ event, key }));
    });
    this.#activeEffects = Object.freeze(active);
    this.#lastFrameStep = frame.current.steps;
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

    const staticLayer = this.#ensureStaticLayer(this.#frame, projection);
    context.drawImage(staticLayer, 0, 0);

    context.save();
    context.beginPath();
    context.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    context.clip();
    context.translate(viewport.x, viewport.y);
    context.scale(projection.scale, projection.scale);
    context.translate(-camera.x, -camera.y);
    drawDynamicWorld(context, this.#frame, this.#atlas, this.#activeEffects);
    context.restore();
    this.#lastDrawnVisualSignature = visualFrameSignature(
      this.#frame,
      this.#activeEffects,
      this.#atlas.status,
    );

    const interpolatedDistance = interpolate(
      this.#frame.previous.distance,
      this.#frame.current.distance,
      this.#frame.interpolation,
    );
    this.#canvas.dataset.interpolatedDistance = String(interpolatedDistance);
  }
}
