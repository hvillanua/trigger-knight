import type {
  EnemyId,
  GameEvent,
  GameObservation,
  InventoryItemId,
  PresentationFrame,
  PresentationPort,
  PresentationTransition,
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
  type VisualAtlas,
  type VisualAtlasStatus,
  type OriginalEffectImageId,
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

import {
  ActorAnimation,
  actorFrameNumber,
  type ActorPose,
  type ActorSpriteId,
} from "./sprite-animation.js";

interface SpriteOptions {
  readonly scale?: number;
  readonly alpha?: number;
  readonly flipX?: boolean;
  readonly frame?: number;
}

interface EffectRecord {
  readonly event: GameEvent;
  readonly key: string;
  readonly startActiveTicks: number;
  readonly anchor: WorldPoint;
  readonly message: string | undefined;
}

const NO_VISUAL_EFFECTS: readonly EffectRecord[] = Object.freeze([]);

interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

const GROUND_RATIO = 0.73;
const HERO_RUNNING_X = 50;
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

const ORIGINAL_HIT_FRAME_IDS: readonly OriginalEffectImageId[] = Object.freeze([
  "hit-1",
  "hit-2",
  "hit-3",
  "hit-4",
  "hit-5",
  "hit-6",
  "hit-7",
]);

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
  runningX = HERO_RUNNING_X,
): number | null {
  const current = frame.current.battle;
  if (current === null) return null;
  const previous = frame.previous.battle;
  if (previous === null) {
    const from =
      actor === "hero"
        ? runningX
        : (frame.previous.encounters.current?.x ?? current.actors.enemy.x);
    return interpolate(from, current.actors[actor].x, frame.interpolation);
  }
  if (
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
    readonly alpha?: number;
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
  context.globalAlpha = options.alpha ?? 1;
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
  context.restore();
}

function drawAtlasSprite(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  spriteId: VisualSpriteId,
  x: number,
  baselineY: number,
  options: SpriteOptions = {},
): boolean {
  const iconIds: Partial<Record<VisualSpriteId, OriginalUiImageId>> = {
    weapon: "weapon-icon",
    armor: "armor-icon",
    "soul-shrine": "shrine-icon",
    elixir: "elixir-icon",
    "divine-edge": "divine-edge-icon",
    "gold-voucher": "voucher-icon",
  };
  const icon = iconIds[spriteId];
  const originalImage =
    options.frame !== undefined
      ? atlas.originalFrames[spriteId as ActorSpriteId]?.[options.frame - 1]
      : icon !== undefined
        ? atlas.uiImages[icon]
        : atlas.originalImages[spriteId];
  if (!imageReady(originalImage)) return false;
  const scale = options.scale ?? 1;
  // Each entity's frames share a padded registration canvas. These anchors are
  // the bottom center of the embedded shadow; never fit or recenter a pose.
  const anchors: Readonly<Record<ActorSpriteId, readonly [number, number]>> = {
    hero: [64.5, 75],
    dragon: [114.5, 115],
    goblin: [62, 98],
    golem: [86.5, 103],
    wolf: [64.5, 65],
  };
  const anchor = anchors[spriteId as ActorSpriteId] ?? [
    originalImage.naturalWidth / 2,
    originalImage.naturalHeight,
  ];
  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.translate(x, baselineY);
  context.scale(options.flipX === true ? -scale : scale, scale);
  try {
    context.drawImage(originalImage, -anchor[0], -anchor[1]);
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
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
  atlas: VisualAtlas,
): void {
  drawSceneImage(context, atlas, "sky", camera.x, camera.y, 960, 320);
}

function drawMovingBackgroundLayer(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  distance: number,
  atlas: VisualAtlas,
  layer: Readonly<{
    readonly id: "mountains" | "ground";
    readonly speed: number;
    readonly y: number;
    readonly height: number;
  }>,
): void {
  const offset = positiveModulo(distance * layer.speed, 960);
  for (let x = camera.x - offset; x < camera.x + camera.width; x += 960) {
    drawSceneImage(
      context,
      atlas,
      layer.id,
      x,
      camera.y + layer.y,
      960,
      layer.height,
    );
  }
}

function drawHero(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  pose: ActorPose,
): void {
  drawAtlasSprite(context, atlas, "hero", x, groundY, {
    frame: pose.frame,
    alpha: pose.alpha,
  });
}

function drawEnemy(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  pose: ActorPose,
): void {
  drawAtlasSprite(context, atlas, pose.id, x, groundY, {
    frame: pose.frame,
    alpha: pose.alpha,
    flipX: true,
  });
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

function drawOriginalBuilding(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
): boolean {
  const image = atlas.sceneImages.building;
  if (!imageReady(image)) return false;
  // The export contains the building's registration padding. Preserve that
  // canvas at runtime scale so its embedded footprint remains authoritative.
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  try {
    context.drawImage(image, x - width / 2, groundY - height, width, height);
    return true;
  } catch {
    return false;
  }
}

function drawShopBuilding(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
): void {
  drawOriginalBuilding(context, atlas, x, groundY);
}

function drawShopDetails(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  x: number,
  groundY: number,
  shop: ShopId,
  available: boolean,
  used: boolean,
): void {
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

function drawEncounterIcon(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  encounter: Readonly<GameObservation["encounters"]["upcoming"][number]>,
  x: number,
  y: number,
): void {
  if (encounter.kind === "shop") {
    drawUiImage(context, atlas, SHOP_UI_ICONS[encounter.shop], x, y, 28, 28);
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
  drawUiImage(context, atlas, "lifespan-fill", x + 2, y + 2, 305 * ratio, 10);
  drawUiImage(context, atlas, "lifespan-frame", x, y, 309, 14);
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
  drawUiImage(context, atlas, "bottom-strip", camera.x, y, 480, 69);

  drawUiImage(context, atlas, "portrait", camera.x - 1, y + 1, 126, 75);

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
  drawUiImage(context, atlas, "hp-fill", hpX, hpY, 97 * hpRatio, 9);
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
  previous: Readonly<GameObservation>,
  events: readonly GameEvent[],
  retainedEffect: Readonly<EffectRecord> | undefined,
): string | null {
  if (retainedEffect !== undefined) {
    if (
      observation.battle !== null &&
      observation.player.inventory.item !== null &&
      retainedEffect.event.type !== "item-use-rejected"
    ) {
      const item = observation.player.inventory.item;
      return item === "elixir"
        ? `You can use ${itemName(item)} to heal HP!`
        : `You can use ${itemName(item)} during battle!`;
    }
    return retainedEffect.message ?? null;
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event === undefined) continue;
    const message = eventContextMessage(event, observation, previous);
    if (message !== null) return message;
  }
  if (
    observation.battle !== null &&
    observation.player.inventory.item !== null
  ) {
    const item = observation.player.inventory.item;
    return item === "elixir"
      ? `You can use ${itemName(item)} to heal HP!`
      : `You can use ${itemName(item)} during battle!`;
  }
  return null;
}

function eventContextMessage(
  event: GameEvent,
  observation: Readonly<GameObservation>,
  previous: Readonly<GameObservation>,
): string | null {
  switch (event.type) {
    case "shop-purchased":
      switch (event.shop) {
        case "bladesmith":
          return `Upgrade: ${previous.player.weapon.name} > ${observation.player.weapon.name}`;
        case "armorsmith":
          return `Upgrade: ${previous.player.armor.name} > ${observation.player.armor.name}`;
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
  return null;
}

function latestRetainedEffect(
  effects: readonly EffectRecord[],
): Readonly<EffectRecord> | undefined {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index];
    if (effect?.message !== undefined) return effect;
  }
  return undefined;
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
  previous: Readonly<GameObservation>,
  events: readonly GameEvent[],
  retainedEffect: Readonly<EffectRecord> | undefined,
): void {
  const message = contextMessage(observation, previous, events, retainedEffect);
  if (message === null) return;
  const camera = observation.camera;
  drawUiImage(
    context,
    atlas,
    "message-strip",
    camera.x,
    camera.y + MESSAGE_STRIP_Y,
    480,
    15,
  );
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
  previous: Readonly<GameObservation>,
  atlas: VisualAtlas,
  events: readonly GameEvent[],
  pointer: WorldPoint | undefined,
  retainedEffect: Readonly<EffectRecord> | undefined,
): void {
  drawGoldAndLifespan(context, atlas, observation);
  drawBottomHud(context, atlas, observation);
  drawContextPrompt(context, atlas, observation, pointer);
  drawMessageStrip(
    context,
    atlas,
    observation,
    previous,
    events,
    retainedEffect,
  );
}

function effectAnchor(
  frame: Readonly<PresentationFrame>,
  event: GameEvent,
  runningX = HERO_RUNNING_X,
): WorldPoint {
  const camera = frame.current.camera;
  const groundY = camera.y + camera.height * GROUND_RATIO;
  const heroX =
    frame.current.battle === null
      ? camera.x + runningX
      : (battleActorX(frame, "hero", runningX) ?? camera.x + runningX);
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
    case "item-used":
      return { x: heroX, y: groundY - 6 };
    case "purchase-rejected":
    case "shop-departed":
      return { x: encounterX, y: groundY - 50 };
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

const VISUAL_EFFECT_EVENT_TYPES: ReadonlySet<GameEvent["type"]> = new Set([
  "achievement-unlocked",
  "battle-reward",
  "battle-started",
  "combat-hit",
  "combat-lethal-hit",
  "encounter-promoted",
  "equipment-discovered",
  "item-use-rejected",
  "item-used",
  "lifespan-death",
  "purchase-rejected",
  "run-ended",
  "shop-departed",
  "shop-purchased",
]);

function isVisualEffectEvent(event: GameEvent): boolean {
  return VISUAL_EFFECT_EVENT_TYPES.has(event.type);
}

/** Visual lifetimes are presentation choices measured in public active ticks. */
function effectLifetime(event: GameEvent): number {
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
      return 45;
    case "item-used":
      return 24;
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

function effectAge(
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
    frame.current.activeTicks,
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
  age: number,
  lifetime: number,
): void {
  const progress = clamp(age / lifetime, 0, 1);
  const radiusScale = 0.65 + progress * 0.55;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.globalAlpha = 0.95 * (1 - progress);
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const inner = size * 0.35 * radiusScale;
    const outer = size * (index % 2 === 0 ? 1 : 0.78) * radiusScale;
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
  context.arc(
    point.x,
    point.y,
    size * (0.25 - progress * 0.08),
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawOriginalHitEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  point: WorldPoint,
  age: number,
): boolean {
  // FXHit's eighth timeline frame is intentionally blank.
  if (age >= ORIGINAL_HIT_FRAME_IDS.length) return true;
  const frameIndex = Math.min(
    ORIGINAL_HIT_FRAME_IDS.length - 1,
    Math.max(0, Math.floor(age)),
  );
  const image = atlas.effectImages[ORIGINAL_HIT_FRAME_IDS[frameIndex]!];
  if (!imageReady(image)) return false;
  context.save();
  try {
    context.drawImage(
      image,
      point.x - image.naturalWidth / 2,
      point.y - image.naturalHeight / 2,
    );
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
}

function effectSeed(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Deterministic particles keep redraws cosmetic and independent of domain RNG. */
function drawParticles(
  context: CanvasRenderingContext2D,
  point: WorldPoint,
  color: string,
  size: number,
  age: number,
  lifetime: number,
  key: string,
): void {
  const progress = clamp(age / lifetime, 0, 1);
  const seed = effectSeed(key) % 360;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.95 * (1 - progress);
  for (let index = 0; index < 10; index += 1) {
    const angle = ((seed + index * 137.5) * Math.PI) / 180;
    const distance = size * (0.25 + progress * (0.55 + (index % 3) * 0.18));
    const x = point.x + Math.cos(angle) * distance;
    const y = point.y + Math.sin(angle) * distance - progress * (index % 2) * 7;
    const radius = Math.max(1, size * (0.055 + (index % 3) * 0.018));
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawFloatingText(
  context: CanvasRenderingContext2D,
  text: string,
  point: WorldPoint,
  age: number,
  lifetime: number,
  options: Readonly<{
    readonly fill: string;
    readonly font: string;
  }>,
): void {
  const progress = clamp(age / lifetime, 0, 1);
  drawOutlinedText(context, text, point.x, point.y - progress * 24, {
    font: options.font,
    fill: options.fill,
    align: "center",
    lineWidth: 2,
    alpha: 1 - progress,
  });
}

function drawEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  frame: Readonly<PresentationFrame>,
  effect: EffectRecord,
): void {
  const point = effect.anchor;
  const age = effectAge(frame, effect);
  const lifetime = effectLifetime(effect.event);
  switch (effect.event.type) {
    case "combat-hit":
      drawOriginalHitEffect(context, atlas, point, age);
      drawFloatingText(
        context,
        formatNumber(effect.event.damage),
        point,
        age,
        lifetime,
        {
          fill: effect.event.critical ? "#ffe9a6" : "#f7f1df",
          font: `700 ${effect.event.critical ? 13 : 11}px ${CANVAS_FONT_FAMILIES.displayMedium}`,
        },
      );
      break;
    case "combat-lethal-hit":
      drawOriginalHitEffect(context, atlas, point, age);
      drawFloatingText(context, "DEFEATED", point, age, lifetime, {
        fill: "#ffb4a8",
        font: `700 10px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      });
      break;
    case "combat-phase-changed":
      break;
    case "battle-started":
    case "encounter-promoted":
      drawParticles(context, point, "#d16a7e", 20, age, lifetime, effect.key);
      drawBurst(context, point, "#d16a7e", 25, age, lifetime);
      break;
    case "shop-purchased": {
      if (
        effect.event.shop === "armorsmith" ||
        effect.event.shop === "bladesmith"
      ) {
        drawParticles(context, point, "#ffe04f", 24, age, lifetime, effect.key);
        drawFloatingText(context, "UPGRADE!", point, age, lifetime, {
          fill: "#ffe04f",
          font: `700 13px ${CANVAS_FONT_FAMILIES.displayMedium}`,
        });
        drawFloatingText(
          context,
          `-Lost ${formatNumber(effect.event.price)}G!`,
          {
            x: frame.current.camera.x + 58,
            y: frame.current.camera.y + 50,
          },
          age,
          lifetime,
          {
            fill: "#f7f1df",
            font: `600 9px ${CANVAS_FONT_FAMILIES.bodySmall}`,
          },
        );
      } else {
        drawParticles(context, point, "#ffe9a6", 20, age, lifetime, effect.key);
      }
      drawAtlasSprite(
        context,
        atlas,
        SHOP_PRODUCTS[effect.event.shop],
        point.x,
        point.y + 26,
        {
          scale: 0.42,
          alpha: 1 - clamp(age / lifetime, 0, 1),
        },
      );
      break;
    }
    case "battle-reward":
      drawParticles(context, point, "#ffe9a6", 20, age, lifetime, effect.key);
      drawFloatingText(
        context,
        `+${formatNumber(effect.event.gold)}G`,
        point,
        age,
        lifetime,
        {
          fill: "#ffe9a6",
          font: `700 11px ${CANVAS_FONT_FAMILIES.displayMedium}`,
        },
      );
      drawAtlasSprite(context, atlas, "gold-voucher", point.x, point.y + 26, {
        scale: 0.42,
        alpha: 1 - clamp(age / lifetime, 0, 1),
      });
      break;
    case "item-used":
      drawParticles(context, point, "#59d9ff", 24, age, lifetime, effect.key);
      drawFloatingText(context, "ITEM USED!", point, age, lifetime, {
        fill: "#59d9ff",
        font: `700 12px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      });
      drawAtlasSprite(
        context,
        atlas,
        effect.event.item,
        point.x,
        point.y + 28,
        {
          scale: 0.45,
          alpha: 1 - clamp(age / lifetime, 0, 1),
        },
      );
      break;
    case "purchase-rejected":
    case "item-use-rejected":
      drawBurst(context, point, "#ffb4a8", 20, age, lifetime);
      break;
    case "shop-departed":
      context.save();
      context.strokeStyle = "#bac6df";
      context.globalAlpha = 0.7 * (1 - clamp(age / lifetime, 0, 1));
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
      drawParticles(context, point, "#ffe9a6", 22, age, lifetime, effect.key);
      drawBurst(context, point, "#ffe9a6", 28, age, lifetime);
      break;
    case "achievement-unlocked":
      drawParticles(context, point, "#ffe9a6", 26, age, lifetime, effect.key);
      drawBurst(context, point, "#ffe9a6", 30, age, lifetime);
      break;
    case "lifespan-death":
    case "run-ended":
      context.save();
      context.fillStyle = "#a9506e";
      context.globalAlpha = 0.22 * (1 - clamp(age / lifetime, 0, 1));
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
  effects.forEach((effect) => drawEffect(context, atlas, frame, effect));
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
  animation: ActorAnimation,
  reducedMotion: boolean,
): void {
  const camera = frame.current.camera;
  const groundY = camera.y + camera.height * GROUND_RATIO;
  const distance = interpolate(
    frame.previous.distance,
    frame.current.distance,
    frame.interpolation,
  );
  const current = frame.current.encounters.current;
  const x = currentEncounterX(frame);
  drawMovingBackgroundLayer(context, camera, distance, atlas, {
    id: "mountains",
    speed: 0.18,
    y: 82,
    height: 120,
  });
  if (current?.kind === "shop" && x !== null) {
    drawShopBuilding(context, atlas, x, groundY);
  }
  drawMovingBackgroundLayer(context, camera, distance, atlas, {
    id: "ground",
    speed: 1,
    y: 164,
    height: 188,
  });
  const pose = (actor: ActorPose): ActorPose =>
    reducedMotion
      ? { ...actor, frame: actorFrameNumber(actor.id, actor.phase, 0) }
      : actor;
  const battle = frame.current.battle;
  if (battle === null) {
    drawHero(
      context,
      atlas,
      camera.x + animation.runningX(distance),
      groundY,
      pose(animation.hero),
    );
  } else {
    const heroX =
      battleActorX(
        frame,
        "hero",
        animation.runningX(frame.previous.distance),
      ) ?? camera.x + HERO_RUNNING_X;
    const enemyX = battleActorX(frame, "enemy") ?? camera.x + 390;
    drawHero(context, atlas, heroX, groundY, pose(animation.hero));
    drawEnemy(context, atlas, enemyX, groundY, pose(animation.enemy!));
    drawHealthBar(
      context,
      enemyX,
      groundY - 106,
      battle.enemy.currentHp,
      battle.enemy.maximumHp,
    );
  }

  if (current !== null && x !== null) {
    if (current.kind === "shop") {
      drawShopDetails(
        context,
        atlas,
        x,
        groundY,
        current.shop,
        frame.current.actions.canPurchaseCurrentEncounter,
        current.used,
      );
    } else if (battle === null) {
      drawEnemy(context, atlas, x, groundY, pose(animation.enemy!));
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
}

/** Canvas 2D adapter for public gameplay observations and events. */
export class CanvasPresentation implements PresentationPort {
  readonly #canvas: HTMLCanvasElement;
  readonly #animation = new ActorAnimation();
  #frame: PresentationFrame | undefined;
  #reducedMotion = false;
  #atlas: VisualAtlas;
  #activeEffects: readonly EffectRecord[] = Object.freeze([]);
  #effectHistory = new Map<string, EffectRecord>();
  #seenEffectKeys = new Set<string>();
  #registeredEffectEvents = new Set<GameEvent>();
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
        status === "ready" ? "atlas" : "missing";
      this.#draw();
    });
    this.#canvas.dataset.assetStatus = this.#atlas.status;
    this.#canvas.dataset.spriteMode =
      this.#atlas.status === "ready" ? "atlas" : "missing";
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

  presentTransition(transition: PresentationTransition): void {
    this.#animation.presentTransition(transition.previous, transition.current);
    this.#registerTransition(
      transition,
      this.#animation.runningX(transition.current.distance),
    );
  }

  present(frame: PresentationFrame): void {
    this.#animation.present(frame.current);
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
    this.#registerTransition(
      normalizedFrame,
      this.#animation.runningX(
        interpolate(
          normalizedFrame.previous.distance,
          normalizedFrame.current.distance,
          normalizedFrame.interpolation,
        ),
      ),
    );
    this.#pruneEffects(normalizedFrame);
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
      this.#atlas.status === "ready" ? "atlas" : "missing";
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
    drawBackground(context, camera, this.#atlas);
    context.restore();

    this.#backgroundLayer = layer;
    this.#backgroundLayerKey = key;
    return layer;
  }

  #registerTransition(
    transition: PresentationTransition,
    runningX = this.#animation.runningX(transition.current.distance),
  ): void {
    if (
      this.#lastFrameStep !== undefined &&
      transition.current.steps < this.#lastFrameStep
    ) {
      this.#effectHistory.clear();
      this.#seenEffectKeys.clear();
      this.#registeredEffectEvents.clear();
      this.#effectSequence = 0;
    }

    const frame = Object.freeze({
      previous: transition.previous,
      current: transition.current,
      interpolation: 1,
      events: transition.events,
    });
    transition.events.forEach((event, index) => {
      if (!isVisualEffectEvent(event)) return;
      if (this.#registeredEffectEvents.has(event)) return;
      this.#registeredEffectEvents.add(event);
      const key = `${transition.current.steps}:${index}:${describeEvent(event)}`;
      if (!this.#seenEffectKeys.has(key)) {
        this.#seenEffectKeys.add(key);
        this.#effectSequence += 1;
        this.#effectHistory.set(
          key,
          Object.freeze({
            event,
            key,
            startActiveTicks: transition.current.activeTicks,
            anchor: effectAnchor(frame, event, runningX),
            message:
              eventContextMessage(
                event,
                transition.current,
                transition.previous,
              ) ?? undefined,
          }),
        );
      }
    });

    this.#lastFrameStep = transition.current.steps;
  }

  #pruneEffects(frame: Readonly<PresentationFrame>): void {
    const active: EffectRecord[] = [];
    for (const [key, effect] of this.#effectHistory) {
      if (effectAge(frame, effect) <= effectLifetime(effect.event)) {
        active.push(effect);
      } else {
        this.#effectHistory.delete(key);
      }
    }
    this.#activeEffects = Object.freeze(active);
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
    drawDynamicWorld(
      context,
      this.#frame,
      this.#atlas,
      this.#animation,
      this.#reducedMotion,
    );
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
        this.#frame.previous,
        this.#atlas,
        this.#frame.events,
        this.#pointerWorld,
        latestRetainedEffect(this.#activeEffects),
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
