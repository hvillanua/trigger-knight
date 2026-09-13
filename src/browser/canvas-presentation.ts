import type {
  CombatActorPhase,
  EnemyId,
  GameEvent,
  GameObservation,
  InventoryItemId,
  PresentationFrame,
  PresentationPort,
  ShopId,
  TutorialPage,
} from "../application/contracts.js";
import {
  describeGameEvent,
  enemyName,
  itemDescription,
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
  type OriginalUiImageId,
  type VisualSpriteId,
} from "./visual-atlas.js";
import {
  calculateBackingStoreSize,
  calculateWorldProjection,
  mapClientPointToWorld,
  type CssDimensions,
} from "./foundation.js";
import { loadOriginalFonts, ORIGINAL_FONT_FAMILIES } from "./font-assets.js";

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

const NO_VISUAL_EFFECTS: readonly EffectRecord[] = Object.freeze([]);

interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

const GROUND_RATIO = 0.73;
const HERO_RUNNING_X = 110;
const GAMEPLAY_HUD_TOP = 8;
const GAMEPLAY_HUD_BOTTOM = 251;
const MESSAGE_STRIP_Y = GAMEPLAY_HUD_BOTTOM - 15;
// Project presentation roles. The original SWF text-field mapping remains unresolved.
const CANVAS_FONT_FAMILIES = Object.freeze({
  body: `"${ORIGINAL_FONT_FAMILIES.calibri}", "${ORIGINAL_FONT_FAMILIES.calibri14}", system-ui, sans-serif`,
  bodyMedium: `"${ORIGINAL_FONT_FAMILIES.calibri14}", "${ORIGINAL_FONT_FAMILIES.calibri}", system-ui, sans-serif`,
  bodySmall: `"${ORIGINAL_FONT_FAMILIES.calibri12}", "${ORIGINAL_FONT_FAMILIES.calibri}", system-ui, sans-serif`,
  compact: `"${ORIGINAL_FONT_FAMILIES.hooge}", "${ORIGINAL_FONT_FAMILIES.calibri12}", system-ui, sans-serif`,
  display: `"${ORIGINAL_FONT_FAMILIES.eurostile}", "${ORIGINAL_FONT_FAMILIES.calibri16}", system-ui, sans-serif`,
  displayMedium: `"${ORIGINAL_FONT_FAMILIES.calibri16}", "${ORIGINAL_FONT_FAMILIES.eurostile}", system-ui, sans-serif`,
  serif: `"${ORIGINAL_FONT_FAMILIES.calisto5}", "${ORIGINAL_FONT_FAMILIES.calibri}", system-ui, sans-serif`,
  serifSmall: `"${ORIGINAL_FONT_FAMILIES.calisto224}", "${ORIGINAL_FONT_FAMILIES.calibri12}", system-ui, sans-serif`,
});

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

const SHOP_UI_ICONS: Readonly<Record<ShopId, OriginalUiImageId>> =
  Object.freeze({
    bladesmith: "weapon-icon",
    armorsmith: "armor-icon",
    "soul-shrine": "shrine-icon",
    pharmacy: "elixir-icon",
    "grims-shop": "divine-edge-icon",
    "voucher-store": "voucher-icon",
  });

const ITEM_UI_ICONS: Readonly<Record<InventoryItemId, OriginalUiImageId>> =
  Object.freeze({
    elixir: "elixir-icon",
    "divine-edge": "divine-edge-icon",
    "gold-voucher": "voucher-icon",
  });

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

function mapCanvasPointer(
  canvas: HTMLCanvasElement,
  camera: Readonly<GameObservation["camera"]>,
  event: PointerEvent,
): WorldPoint | null {
  const rect = canvas.getBoundingClientRect();
  const styles = window.getComputedStyle(canvas);
  return mapClientPointToWorld(
    camera,
    { width: canvas.width, height: canvas.height },
    {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    },
    rect,
    { x: event.clientX, y: event.clientY },
    {
      left: Number.parseFloat(styles.borderLeftWidth) || 0,
      top: Number.parseFloat(styles.borderTopWidth) || 0,
      right: Number.parseFloat(styles.borderRightWidth) || 0,
      bottom: Number.parseFloat(styles.borderBottomWidth) || 0,
    },
  );
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

function uiImageReady(
  atlas: VisualAtlas,
  imageId: OriginalUiImageId,
): HTMLImageElement | undefined {
  const image = atlas.uiImages[imageId];
  return imageReady(image) ? image : undefined;
}

function drawUiImage(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  imageId: OriginalUiImageId,
  x: number,
  y: number,
  width?: number,
  height?: number,
  alpha = 1,
): boolean {
  const image = uiImageReady(atlas, imageId);
  if (image === undefined) return false;
  const targetWidth = width ?? image.naturalWidth;
  const targetHeight = height ?? image.naturalHeight;
  context.save();
  context.globalAlpha = alpha;
  try {
    context.drawImage(image, x, y, targetWidth, targetHeight);
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
}

function drawOutlinedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: Readonly<{
    readonly font: string;
    readonly fill?: string;
    readonly stroke?: string;
    readonly lineWidth?: number;
    readonly align?: CanvasTextAlign;
    readonly baseline?: CanvasTextBaseline;
  }>,
): void {
  context.save();
  context.font = options.font;
  context.textAlign = options.align ?? "left";
  context.textBaseline = options.baseline ?? "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = options.lineWidth ?? 3;
  context.strokeStyle = options.stroke ?? "#080b14";
  context.fillStyle = options.fill ?? "#f7f1df";
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
  context.restore();
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
  context.fillStyle = "#63cde4";
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
    gradient.addColorStop(0, day % 2 === 0 ? "#63cde4" : "#86d7e6");
    gradient.addColorStop(0.62, "#d9edf0");
    gradient.addColorStop(1, "#77c779");
    context.fillStyle = gradient;
    context.fillRect(camera.x, camera.y, camera.width, camera.height);
  }

  const originalMountains = drawSceneImage(
    context,
    atlas,
    "mountains",
    camera.x,
    camera.y + 82,
    960,
    120,
  );
  if (!originalMountains) {
    context.fillStyle = "#3a8a8c";
    context.beginPath();
    context.moveTo(camera.x, camera.y + 204);
    for (let x = camera.x - 40; x <= camera.x + camera.width + 40; x += 52) {
      const peak = camera.y + 154 + ((Math.floor(x / 52) + day) % 3) * 11;
      context.lineTo(x + 26, peak);
      context.lineTo(x + 52, camera.y + 204);
    }
    context.lineTo(camera.x + camera.width, camera.y + 204);
    context.closePath();
    context.fill();
  }

  const groundY = camera.y + camera.height * GROUND_RATIO;
  const originalGround = drawSceneImage(
    context,
    atlas,
    "ground",
    camera.x,
    camera.y + 164,
    960,
    188,
  );
  if (!originalGround) {
    context.fillStyle = "#2d8f48";
    context.fillRect(camera.x, groundY, camera.width, camera.height * 0.08);
    context.fillStyle = "#4fc65c";
    context.fillRect(
      camera.x,
      groundY + camera.height * 0.08,
      camera.width,
      camera.height * 0.19,
    );
    context.fillStyle = "#379e4c";
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
  context.font = `600 9px ${CANVAS_FONT_FAMILIES.compact}`;
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
    scale: 1.42,
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
  context.font = `600 8px ${CANVAS_FONT_FAMILIES.body}`;
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
  context.font = `700 9px ${CANVAS_FONT_FAMILIES.serif}`;
  context.textAlign = "center";
  context.fillText(shopName(shop), x, groundY + 13);
  context.fillStyle = "#bac6df";
  context.font = `500 8px ${CANVAS_FONT_FAMILIES.serifSmall}`;
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

function drawEncounterIcon(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  encounter: Readonly<GameObservation["encounters"]["upcoming"][number]>,
  x: number,
  y: number,
): void {
  if (encounter.kind === "shop") {
    if (
      !drawUiImage(context, atlas, SHOP_UI_ICONS[encounter.shop], x, y, 28, 28)
    ) {
      drawAtlasSprite(
        context,
        atlas,
        SHOP_PRODUCTS[encounter.shop],
        x + 14,
        y + 28,
        {
          scale: 0.35,
        },
      );
    }
    return;
  }
  drawAtlasSprite(context, atlas, "weapon", x + 14, y + 28, { scale: 0.35 });
}

function drawCurrentEncounterIcon(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  encounter: Readonly<GameObservation["encounters"]["current"]>,
  x: number,
  y: number,
): void {
  if (encounter === null) return;
  if (encounter.kind === "shop") {
    drawEncounterIcon(context, atlas, encounter, x, y);
    return;
  }
  drawAtlasSprite(
    context,
    atlas,
    ENEMY_SPRITES[encounter.enemy.id],
    x + 14,
    y + 28,
    {
      scale: 0.35,
    },
  );
}

function drawLifeBar(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  camera: Readonly<GameObservation["camera"]>,
  lifespan: Readonly<GameObservation["lifespan"]>,
): void {
  const ratio = clamp((lifespan.whole + lifespan.fraction / 100) / 100, 0, 1);
  const x = camera.x + 162;
  const y = camera.y + GAMEPLAY_HUD_TOP;
  if (
    !drawUiImage(context, atlas, "lifespan-fill", x + 2, y + 2, 305 * ratio, 10)
  ) {
    context.save();
    context.fillStyle = "#f1ac2c";
    context.fillRect(x + 2, y + 2, 305 * ratio, 10);
    context.restore();
  }
  if (!drawUiImage(context, atlas, "lifespan-frame", x, y, 309, 14)) {
    context.save();
    context.strokeStyle = "#080b14";
    context.lineWidth = 2;
    context.strokeRect(x, y, 309, 14);
    context.restore();
  }
  drawOutlinedText(context, "LIFESPAN", camera.x + 237, camera.y + 28, {
    font: `700 14px ${CANVAS_FONT_FAMILIES.displayMedium}`,
    align: "center",
    lineWidth: 2,
  });
  drawOutlinedText(
    context,
    formatLifespan(lifespan),
    camera.x + 451,
    camera.y + 31,
    {
      font: `700 19px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 3,
    },
  );
}

function drawEncounterQueue(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
): void {
  const x = observation.camera.x + 288;
  const y = observation.camera.y + 36;
  const slotWidth = 38;
  context.save();
  context.fillStyle = "#080b14";
  context.font = `600 8px ${CANVAS_FONT_FAMILIES.serifSmall}`;
  context.textAlign = "center";
  context.fillText("Now", x + 16, y + 8);
  context.fillText("Next", x + 62, y + 8);
  context.restore();

  const current = observation.encounters.current;
  const entries = observation.encounters.upcoming.slice(0, 4);
  if (current !== null) {
    drawCurrentEncounterIcon(context, atlas, current, x, y + 11);
    if (entries.length > 0) {
      drawOutlinedText(context, "▶", x + 35, y + 30, {
        font: `700 12px ${CANVAS_FONT_FAMILIES.body}`,
        align: "center",
        lineWidth: 2,
      });
    }
    if (current.kind === "shop") {
      drawOutlinedText(
        context,
        `${formatNumber(current.cachedPrice)}G`,
        x + 14,
        y + 48,
        {
          font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
          align: "center",
          lineWidth: 2,
        },
      );
    }
  } else {
    context.save();
    context.strokeStyle = "#080b14";
    context.lineWidth = 1;
    context.strokeRect(x, y + 11, 28, 28);
    context.restore();
  }
  entries.forEach((entry, index) => {
    const slotX = x + index * slotWidth;
    const entryX = slotX + slotWidth;
    if (entry.kind === "shop") {
      drawEncounterIcon(context, atlas, entry, entryX, y + 11);
    } else {
      drawAtlasSprite(context, atlas, "weapon", entryX + 14, y + 39, {
        scale: 0.35,
      });
    }
    if (index < entries.length - 1) {
      drawOutlinedText(context, "▶", slotX + 31, y + 30, {
        font: `700 12px ${CANVAS_FONT_FAMILIES.body}`,
        align: "center",
        lineWidth: 2,
      });
    }
    if (entry.kind === "shop") {
      drawOutlinedText(
        context,
        `${formatNumber(entry.cachedPrice)}G`,
        entryX + 14,
        y + 48,
        {
          font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
          align: "center",
          lineWidth: 2,
        },
      );
    }
  });
}

function drawBottomHud(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
): void {
  const camera = observation.camera;
  const y = camera.y + GAMEPLAY_HUD_BOTTOM;
  const hasOriginalStrip = drawUiImage(
    context,
    atlas,
    "bottom-strip",
    camera.x,
    y,
    480,
    69,
  );
  if (!hasOriginalStrip) {
    context.save();
    context.fillStyle = "#061018";
    context.fillRect(camera.x, y, camera.width, 69);
    context.restore();
  }
  drawUiImage(context, atlas, "portrait", camera.x - 1, y + 1, 126, 75);
  if (!hasOriginalStrip) {
    drawOutlinedText(context, "STATUS", camera.x + 126, y + 14, {
      font: `700 11px ${CANVAS_FONT_FAMILIES.compact}`,
      align: "center",
      lineWidth: 2,
    });
  }
  const hpRatio =
    observation.player.hp.maximum <= 0
      ? 0
      : clamp(
          observation.player.hp.current / observation.player.hp.maximum,
          0,
          1,
        );
  const hpX = camera.x + 126;
  const hpY = y + 22;
  if (!drawUiImage(context, atlas, "hp-fill", hpX, hpY, 97 * hpRatio, 9)) {
    context.fillStyle = "#a9e75a";
    context.fillRect(hpX, hpY, 97 * hpRatio, 9);
  }
  drawUiImage(context, atlas, "hp-frame", hpX, hpY - 2, 101, 13);
  drawOutlinedText(context, "HP", hpX + 7, hpY + 7, {
    font: `700 9px ${CANVAS_FONT_FAMILIES.displayMedium}`,
    lineWidth: 2,
  });
  drawOutlinedText(
    context,
    `${formatNumber(observation.player.hp.current)}/${formatNumber(observation.player.hp.maximum)}`,
    hpX + 100,
    hpY + 9,
    {
      font: `700 10px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );

  if (!hasOriginalStrip) {
    drawOutlinedText(context, "EQUIPMENT", camera.x + 274, y + 14, {
      font: `700 11px ${CANVAS_FONT_FAMILIES.compact}`,
      align: "center",
      lineWidth: 2,
    });
  }
  const inventoryItem = observation.player.inventory.item;
  const equipmentRows: readonly (readonly [
    OriginalUiImageId | null,
    string,
  ])[] = [
    [
      "weapon-icon",
      `${observation.player.weapon.name} [${formatNumber(observation.player.weapon.attack)} ATK]`,
    ],
    ["armor-icon", observation.player.armor.name],
    [
      inventoryItem === null ? null : ITEM_UI_ICONS[inventoryItem],
      inventoryItem === null ? "—" : itemName(inventoryItem),
    ],
  ];
  equipmentRows.forEach(([icon, label], index) => {
    const rowY = y + 26 + index * 13;
    if (icon !== null) {
      drawUiImage(context, atlas, icon, camera.x + 218, rowY - 8, 16, 16);
    }
    drawOutlinedText(context, label, camera.x + 238, rowY + 3, {
      font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
      lineWidth: 2,
    });
  });

  if (!hasOriginalStrip) {
    drawOutlinedText(context, "SCORE", camera.x + 414, y + 14, {
      font: `700 11px ${CANVAS_FONT_FAMILIES.compact}`,
      align: "center",
      lineWidth: 2,
    });
  }
  drawOutlinedText(
    context,
    formatNumber(observation.score),
    camera.x + 465,
    y + 31,
    {
      font: `700 14px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );
  drawOutlinedText(
    context,
    `DAY ${formatNumber(observation.day)}`,
    camera.x + 465,
    y + 57,
    {
      font: `700 13px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );
}

function drawGoldAndLifespan(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
): void {
  const camera = observation.camera;
  drawUiImage(context, atlas, "gold-bag", camera.x + 7, camera.y + 8, 29, 29);
  drawOutlinedText(
    context,
    `${formatNumber(observation.player.gold)}G`,
    camera.x + 40,
    camera.y + 29,
    {
      font: `700 16px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      lineWidth: 3,
    },
  );
  drawLifeBar(context, atlas, camera, observation.lifespan);
  drawEncounterQueue(context, atlas, observation);
}

function contextMessage(
  observation: Readonly<GameObservation>,
  events: readonly GameEvent[],
): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined) continue;
    switch (event.type) {
      case "shop-purchased":
        switch (event.shop) {
          case "bladesmith":
            return `Weapon upgraded: ${observation.player.weapon.name}`;
          case "armorsmith":
            return `Armor upgraded: ${observation.player.armor.name}`;
          case "soul-shrine":
            return "Lifespan restored!";
          case "pharmacy":
            return "Elixir acquired!";
          case "grims-shop":
            return "Divine Edge acquired!";
          case "voucher-store":
            return "Gold Voucher acquired!";
        }
        break;
      case "item-used":
        return "ITEM USED!";
      case "battle-reward":
        return `Reward: +${formatNumber(event.gold)}G`;
      case "purchase-rejected":
        return event.reason === "insufficient-gold"
          ? "Insufficient gold"
          : "Purchase unavailable";
      case "item-use-rejected":
        return "ITEM UNAVAILABLE";
      default:
        break;
    }
  }
  if (
    observation.battle !== null &&
    observation.player.inventory.item !== null
  ) {
    const item = observation.player.inventory.item;
    return `${itemName(item)}: ${itemDescription(item)}`;
  }
  return null;
}

function drawContextPrompt(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  pointer: WorldPoint | undefined,
): void {
  const groundY =
    observation.camera.y + observation.camera.height * GROUND_RATIO;
  const current = observation.encounters.current;
  const x = clamp(
    pointer?.x ?? current?.x ?? observation.camera.x + 235,
    observation.camera.x + 36,
    observation.camera.x + observation.camera.width - 36,
  );
  const y = pointer?.y ?? groundY - 58;
  const drawNoAction = (): void => {
    context.save();
    context.strokeStyle = "#ef2a2a";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x - 12, y - 12);
    context.lineTo(x + 12, y + 12);
    context.moveTo(x + 12, y - 12);
    context.lineTo(x - 12, y + 12);
    context.stroke();
    context.restore();
    drawOutlinedText(context, "No Action!", x, y + 30, {
      font: `700 9px ${CANVAS_FONT_FAMILIES.bodySmall}`,
      align: "center",
      lineWidth: 2,
    });
  };

  if (current?.kind === "shop") {
    const eligible = observation.actions.canPurchaseCurrentEncounter;
    if (eligible) {
      drawUiImage(context, atlas, "pointer-click", x - 9, y - 10, 18, 22);
    } else {
      drawNoAction();
    }
    drawOutlinedText(context, shopName(current.shop), x, y - 24, {
      font: `700 9px ${CANVAS_FONT_FAMILIES.serifSmall}`,
      align: "center",
      fill: "#f4df51",
      lineWidth: 2,
    });
    drawOutlinedText(
      context,
      shopDescription(current.shop).replace(/\.$/, ""),
      x,
      y + 7,
      {
        font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
        align: "center",
        lineWidth: 2,
      },
    );
    drawOutlinedText(
      context,
      `${formatNumber(current.cachedPrice)}G${
        eligible
          ? ""
          : current.used
            ? " (Used)"
            : observation.player.gold < current.cachedPrice
              ? " (Insufficient)"
              : " (Unavailable)"
      }`,
      x,
      y + 18,
      {
        font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
        align: "center",
        lineWidth: 2,
      },
    );
    return;
  }
  if (
    observation.battle !== null &&
    observation.player.inventory.item !== null
  ) {
    const canUseItem = observation.actions.canUseCarriedItem;
    if (canUseItem) {
      drawUiImage(context, atlas, "pointer-click", x - 9, y - 10, 18, 22);
    } else {
      drawNoAction();
    }
    drawOutlinedText(context, "Battle", x, y - 22, {
      font: `700 9px ${CANVAS_FONT_FAMILIES.serifSmall}`,
      align: "center",
      fill: "#f4df51",
      lineWidth: 2,
    });
    drawOutlinedText(
      context,
      `Use ${itemName(observation.player.inventory.item)}`,
      x,
      y + 8,
      {
        font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
        align: "center",
        lineWidth: 2,
      },
    );
    drawOutlinedText(
      context,
      canUseItem
        ? itemDescription(observation.player.inventory.item).replace(
            /\. Usable during battle\.$/,
            "",
          )
        : "(Unavailable)",
      x,
      y + 19,
      {
        font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
        align: "center",
        lineWidth: 2,
      },
    );
    return;
  }
  drawNoAction();
}

function drawMessageStrip(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  events: readonly GameEvent[],
): void {
  const message = contextMessage(observation, events);
  if (message === null) return;
  const camera = observation.camera;
  if (
    !drawUiImage(
      context,
      atlas,
      "message-strip",
      camera.x,
      camera.y + MESSAGE_STRIP_Y,
      480,
      15,
    )
  ) {
    context.fillStyle = "#ed8c00";
    context.fillRect(camera.x, camera.y + MESSAGE_STRIP_Y, camera.width, 15);
  }
  drawOutlinedText(
    context,
    message,
    camera.x + camera.width / 2,
    camera.y + MESSAGE_STRIP_Y + 11,
    {
      font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
      align: "center",
      lineWidth: 2,
    },
  );
}

function drawGameplayHud(
  context: CanvasRenderingContext2D,
  observation: Readonly<GameObservation>,
  atlas: VisualAtlas,
  events: readonly GameEvent[],
  pointer: WorldPoint | undefined,
): void {
  drawGoldAndLifespan(context, atlas, observation);
  drawBottomHud(context, atlas, observation);
  drawContextPrompt(context, atlas, observation, pointer);
  drawMessageStrip(context, atlas, observation, events);
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
    observation.actions.canUseCarriedItem,
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
      break;
    case "tutorial-dismissed":
      context.save();
      context.fillStyle = "#bac6df";
      context.font = `600 10px ${CANVAS_FONT_FAMILIES.serifSmall}`;
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

const TUTORIAL_COPY: Readonly<
  Record<
    TutorialPage,
    Readonly<{ title: string; copy: string; guidance?: readonly string[] }>
  >
> = Object.freeze({
  0: {
    title: "SURVIVE!",
    copy: "Guide the Knight to survive as long as possible using only a single click every time!",
    guidance: [
      "Game will end if your lifespan or HP becomes 0, so be careful.",
      "Getting hit by the Enemy reduces your HP, while Lifespan reduces gradually over time.",
    ],
  },
  1: {
    title: "BUILDINGS",
    copy: "Buildings appear along the route. Click when an action is available to use the current building.",
  },
  2: {
    title: "SOUL SHRINE",
    copy: "A Soul Shrine restores lifespan when you reach it and can afford its cached price.",
  },
  3: {
    title: "AUTOMATIC BATTLE",
    copy: "Combat runs automatically. Use a carried item during battle when it helps you survive.",
  },
  4: {
    title: "LOW LIFESPAN",
    copy: "Your lifespan is running low. Look for a Soul Shrine before the run ends.",
  },
  5: {
    title: "LOW HP",
    copy: "Your HP is low. Use a carried item during battle if one is available.",
  },
});

function drawTutorialWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxCharacters: number,
  lineHeight: number,
): void {
  const words = text.split(" ");
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && next.length > maxCharacters) {
      drawOutlinedText(context, line, x, y + lineIndex * lineHeight, {
        font: `600 11px ${CANVAS_FONT_FAMILIES.body}`,
        lineWidth: 2,
      });
      line = word;
      lineIndex += 1;
    } else {
      line = next;
    }
  }
  if (line !== "") {
    drawOutlinedText(context, line, x, y + lineIndex * lineHeight, {
      font: `600 11px ${CANVAS_FONT_FAMILIES.body}`,
      lineWidth: 2,
    });
  }
}

function drawTutorialSurvivalIllustrations(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  panelX: number,
  panelY: number,
): void {
  const hpX = panelX + 12;
  const hpY = panelY + 112;
  context.save();
  context.fillStyle = "#061018";
  context.fillRect(hpX, hpY, 150, 80);
  context.fillStyle = "#9bdc58";
  context.fillRect(hpX, hpY, 150, 18);
  context.restore();
  drawUiImage(context, atlas, "bottom-strip", hpX, hpY + 14, 150, 22);
  const hpRatio = clamp(
    observation.player.hp.current / observation.player.hp.maximum,
    0,
    1,
  );
  drawUiImage(context, atlas, "hp-fill", hpX + 24, hpY + 45, 97 * hpRatio, 9);
  drawUiImage(context, atlas, "hp-frame", hpX + 23, hpY + 43, 101, 13);
  drawOutlinedText(context, "HP", hpX + 34, hpY + 54, {
    font: `700 10px ${CANVAS_FONT_FAMILIES.displayMedium}`,
    lineWidth: 2,
  });
  drawOutlinedText(
    context,
    `${formatNumber(observation.player.hp.current)}/${formatNumber(observation.player.hp.maximum)}`,
    hpX + 112,
    hpY + 56,
    {
      font: `700 10px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );
  context.save();
  context.strokeStyle = "#f7f1df";
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(hpX + 74, hpY + 50, 64, 20, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  const queueX = panelX + 288;
  const queueY = panelY + 181;
  context.save();
  context.fillStyle = "#63cde4";
  context.fillRect(queueX, queueY, 150, 94);
  context.strokeStyle = "#080b14";
  context.lineWidth = 1;
  context.strokeRect(queueX, queueY, 150, 94);
  context.restore();
  const lifespanRatio = clamp(
    (observation.lifespan.whole + observation.lifespan.fraction / 100) / 100,
    0,
    1,
  );
  drawUiImage(
    context,
    atlas,
    "lifespan-fill",
    queueX + 3,
    queueY + 4,
    144 * lifespanRatio,
    5,
  );
  drawUiImage(context, atlas, "lifespan-frame", queueX + 2, queueY + 3, 146, 7);
  drawOutlinedText(
    context,
    formatLifespan(observation.lifespan),
    queueX + 143,
    queueY + 22,
    {
      font: `700 14px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );
  drawOutlinedText(context, "Next", queueX + 20, queueY + 40, {
    font: `600 9px ${CANVAS_FONT_FAMILIES.serifSmall}`,
    align: "center",
    lineWidth: 2,
  });
  observation.encounters.upcoming.slice(0, 3).forEach((entry, index) => {
    drawEncounterIcon(
      context,
      atlas,
      entry,
      queueX + 4 + index * 44,
      queueY + 48,
    );
  });
}

function drawTutorialOverlay(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
): void {
  const page = observation.lifecycle.tutorialPage;
  if (page === null) return;
  const camera = observation.camera;
  const panelX = camera.x + 10;
  const panelY = camera.y + 10;
  const panelWidth = camera.width - 20;
  const panelHeight = 300;
  context.save();
  context.fillStyle = "#061008";
  context.globalAlpha = 0.88;
  context.fillRect(panelX, panelY, panelWidth, panelHeight);
  context.globalAlpha = 1;
  context.restore();
  const content = TUTORIAL_COPY[page];
  drawOutlinedText(context, content.title, panelX + 20, panelY + 35, {
    font: `700 20px ${CANVAS_FONT_FAMILIES.displayMedium}`,
    lineWidth: 2,
  });
  drawOutlinedText(
    context,
    `Page ${page + 1} of 6`,
    panelX + panelWidth - 18,
    panelY + 24,
    {
      font: `600 8px ${CANVAS_FONT_FAMILIES.bodySmall}`,
      align: "right",
      lineWidth: 2,
    },
  );
  drawTutorialWrappedText(
    context,
    content.copy,
    panelX + 28,
    panelY + 72,
    54,
    18,
  );
  if (page === 0 && content.guidance !== undefined) {
    const [firstGuidance, secondGuidance] = content.guidance;
    drawTutorialSurvivalIllustrations(
      context,
      atlas,
      observation,
      panelX,
      panelY,
    );
    if (firstGuidance !== undefined) {
      drawTutorialWrappedText(
        context,
        firstGuidance,
        panelX + 180,
        panelY + 134,
        32,
        16,
      );
    }
    if (secondGuidance !== undefined) {
      drawTutorialWrappedText(
        context,
        secondGuidance,
        panelX + 20,
        panelY + 236,
        48,
        16,
      );
    }
  }
  drawOutlinedText(
    context,
    "- Click to Continue -",
    panelX + 18,
    panelY + panelHeight - 14,
    {
      font: `600 10px ${CANVAS_FONT_FAMILIES.serifSmall}`,
      lineWidth: 2,
    },
  );
}

function drawPauseOverlay(
  context: CanvasRenderingContext2D,
  observation: Readonly<GameObservation>,
): void {
  const camera = observation.camera;
  const centerX = camera.x + camera.width / 2;
  const centerY = camera.y + 158;
  drawOutlinedText(context, "- Game Paused -", centerX, centerY, {
    font: `700 14px ${CANVAS_FONT_FAMILIES.body}`,
    fill: "#080b14",
    stroke: "#f7f1df",
    lineWidth: 1,
    align: "center",
  });
  drawOutlinedText(
    context,
    "Press 'P' or click 'Resume Game' to resume",
    centerX,
    centerY + 22,
    {
      font: `600 10px ${CANVAS_FONT_FAMILIES.body}`,
      fill: "#080b14",
      stroke: "#f7f1df",
      lineWidth: 1,
      align: "center",
    },
  );
  drawOutlinedText(
    context,
    "'M' and 'S' also can be used to mute Music and SFX.",
    centerX,
    centerY + 56,
    {
      font: `600 10px ${CANVAS_FONT_FAMILIES.body}`,
      fill: "#080b14",
      stroke: "#f7f1df",
      lineWidth: 1,
      align: "center",
    },
  );
}

function drawDynamicWorld(
  context: CanvasRenderingContext2D,
  frame: Readonly<PresentationFrame>,
  atlas: VisualAtlas,
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
      context.font = `700 9px ${CANVAS_FONT_FAMILIES.bodySmall}`;
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
}

/** Canvas 2D adapter for public gameplay observations and events. */
export class CanvasPresentation implements PresentationPort {
  readonly #canvas: HTMLCanvasElement;
  #frame: PresentationFrame | undefined;
  #reducedMotion = false;
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
  #pointerWorld: WorldPoint | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#canvas.dataset.renderer = "canvas-2d";
    this.#canvas.dataset.visualVersion = "original-assets-v1";
    this.#canvas.dataset.assetSource = "original-runtime-assets";
    this.#canvas.dataset.fontStatus = "loading";
    this.#atlas = createVisualAtlas((status) => {
      this.#canvas.dataset.assetStatus = status;
      this.#canvas.dataset.spriteMode =
        status === "ready" ? "atlas" : "fallback";
      this.#draw();
    });
    this.#canvas.dataset.assetStatus = this.#atlas.status;
    this.#canvas.dataset.spriteMode =
      this.#atlas.status === "ready" ? "atlas" : "fallback";
    this.#canvas.dataset.reducedMotion = "false";
    this.#canvas.addEventListener("pointermove", (event) => {
      const frame = this.#frame;
      if (frame === undefined) return;
      const point = mapCanvasPointer(this.#canvas, frame.current.camera, event);
      this.#pointerWorld = point === null ? undefined : point;
      this.#draw();
    });
    this.#canvas.addEventListener("pointerleave", () => {
      this.#pointerWorld = undefined;
      this.#draw();
    });
    void loadOriginalFonts().then((loaded) => {
      this.#staticLayerKey = undefined;
      this.#lastDrawnVisualSignature = undefined;
      this.#canvas.dataset.fontStatus = loaded ? "ready" : "fallback";
      this.#draw();
    });
  }

  /** Disables optional visual effects without changing public game state. */
  setReducedMotion(reducedMotion: boolean): void {
    if (this.#reducedMotion === reducedMotion) return;
    this.#reducedMotion = reducedMotion;
    this.#canvas.dataset.reducedMotion = String(reducedMotion);
    this.#lastDrawnVisualSignature = undefined;
    this.#draw();
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
      interpolation: this.#reducedMotion
        ? 1
        : Number.isFinite(frame.interpolation)
          ? clamp(frame.interpolation, 0, 1)
          : 1,
      events: Object.freeze([...frame.events]),
    });
    this.#frame = normalizedFrame;
    this.#registerEffects(normalizedFrame);
    const visibleEffects = this.#reducedMotion
      ? NO_VISUAL_EFFECTS
      : this.#activeEffects;
    const visualSignature = visualFrameSignature(
      normalizedFrame,
      visibleEffects,
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
    this.#canvas.dataset.activeEffects = visibleEffects
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
    const visibleEffects = this.#reducedMotion
      ? NO_VISUAL_EFFECTS
      : this.#activeEffects;
    drawDynamicWorld(context, this.#frame, this.#atlas);
    if (this.#frame.current.lifecycle.paused) {
      drawPauseOverlay(context, this.#frame.current);
    } else if (this.#frame.current.lifecycle.tutorialPage !== null) {
      drawTutorialOverlay(context, this.#atlas, this.#frame.current);
    }
    drawEffects(context, this.#atlas, this.#frame, visibleEffects);
    if (
      !this.#frame.current.lifecycle.paused &&
      this.#frame.current.lifecycle.tutorialPage === null
    ) {
      drawGameplayHud(
        context,
        this.#frame.current,
        this.#atlas,
        this.#activeEffects.map(({ event }) => event),
        this.#pointerWorld,
      );
    }
    context.restore();
    this.#lastDrawnVisualSignature = visualFrameSignature(
      this.#frame,
      visibleEffects,
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
