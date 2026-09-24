import type {
  GameEvent,
  GameObservation,
  PresentationFrame,
  PresentationPort,
  PresentationTransition,
  TutorialPage,
} from "../application/contracts.js";
import { itemDescription, itemName, shopDescription, shopName } from "./hud.js";
import {
  type VisualAtlas,
  type OriginalActionEffectId,
  type OriginalUiImageId,
  type VisualSpriteId,
  type VisualImage,
} from "./visual-atlas.js";
import {
  CanvasDiagnostics,
  visualFrameSignature,
} from "./canvas-diagnostics.js";
import {
  CanvasEffectTracker,
  clickEffectAge,
  effectAge,
  effectLifetime,
  NO_VISUAL_EFFECTS,
  sameEventList,
  type EffectRecord,
} from "./canvas-effects.js";
import { createCanvasResources } from "./canvas-resources.js";
import {
  actionPointerImageId as drawingActionPointerImageId,
  calculateEffectAnchor,
  contextPromptMode,
  drawClippedHealthFill as drawClippedHealthFillAsset,
  drawClippedLifespanFill as drawClippedLifespanFillAsset,
  drawHealthBar as drawHealthBarAsset,
  drawOriginalActionEffect as drawOriginalActionEffectAsset,
  drawOriginalClickEffect as drawOriginalClickEffectAsset,
  drawOriginalFlashEffect as drawOriginalFlashEffectAsset,
  drawOriginalHitEffect as drawOriginalHitEffectAsset,
  drawScenery,
  drawSceneImage as drawSceneImageAsset,
  drawUiImageAsset,
  encounterQueueItems,
  imageReady as drawingImageReady,
  originalEventVisual,
  sessionOverPointerPosition,
  statusIconPlacements,
  tutorialLifespanCrop,
  type WorldPoint,
} from "./canvas-drawing.js";
import {
  calculateBackingStoreSize,
  calculateWorldProjection,
  mapClientPointToWorld,
  type CssDimensions,
} from "./foundation.js";
import { ORIGINAL_FONT_FAMILIES } from "./font-assets.js";
import type { VisualAssetPack } from "./visual-assets.js";

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

const GROUND_RATIO = 0.73;
const HERO_RUNNING_X = 50;
const GAMEPLAY_HUD_BOTTOM = 251;
const MESSAGE_STRIP_Y = GAMEPLAY_HUD_BOTTOM - 15;
const ORIGINAL_FLASH_EFFECT_LIFETIME = 10;
const SESSION_OVER_FRAME_COUNT = 5;
const SESSION_OVER_FRAME_MS = 1000 / 30;
const SESSION_OVER_ANIMATION_DURATION_MS =
  (SESSION_OVER_FRAME_COUNT - 1) * SESSION_OVER_FRAME_MS;
const SESSION_OVER_TOP_START_OFFSET = -45;
const SESSION_OVER_TOP_END_OFFSET = 0;
const SESSION_OVER_BOTTOM_START_OFFSET = 330;
const SESSION_OVER_BOTTOM_END_OFFSET = 280;
const SESSION_OVER_BAND_HEIGHT = 41;
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

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
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

function uiImageReady(
  atlas: VisualAtlas,
  imageId: OriginalUiImageId,
): VisualImage | undefined {
  const image = atlas.uiImages[imageId];
  return drawingImageReady(image) ? image : undefined;
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
  return drawUiImageAsset(
    context,
    uiImageReady(atlas, imageId),
    x,
    y,
    width,
    height,
    alpha,
  );
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

function actionPointerImageId(
  observation: Readonly<GameObservation>,
): "pointer" | "pointer-click" {
  return drawingActionPointerImageId(observation);
}

function drawActionPointer(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  x: number,
  y: number,
): void {
  drawUiImage(
    context,
    atlas,
    actionPointerImageId(observation),
    x - 9,
    y - 10,
    18,
    22,
  );
}

function isActorSpriteId(spriteId: VisualSpriteId): spriteId is ActorSpriteId {
  switch (spriteId) {
    case "hero":
    case "dragon":
    case "goblin":
    case "golem":
    case "wolf":
      return true;
    default:
      return false;
  }
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
    weapon: "weapon-upgrade-icon",
    armor: "armor-upgrade-icon",
    "soul-shrine": "shrine-icon",
    elixir: "elixir-icon",
    "divine-edge": "divine-edge-icon",
    "gold-voucher": "voucher-icon",
  };
  const icon = iconIds[spriteId];
  const originalImage =
    options.frame !== undefined && isActorSpriteId(spriteId)
      ? atlas.originalFrames[spriteId]?.[options.frame - 1]
      : icon !== undefined
        ? atlas.uiImages[icon]
        : atlas.originalImages[spriteId];
  if (!drawingImageReady(originalImage)) return false;
  const image = originalImage.image;
  const pixelDensity = originalImage.pixelDensity;
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
  const anchor: readonly [number, number] = isActorSpriteId(spriteId)
    ? [anchors[spriteId][0] * pixelDensity, anchors[spriteId][1] * pixelDensity]
    : [image.naturalWidth / 2, image.naturalHeight];
  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.translate(x, baselineY);
  const logicalScale = scale / pixelDensity;
  context.scale(
    options.flipX === true ? -logicalScale : logicalScale,
    logicalScale,
  );
  try {
    context.drawImage(image, -anchor[0], -anchor[1]);
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
}

function drawBackground(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  atlas: VisualAtlas,
): void {
  drawSceneImageAsset(
    context,
    atlas.sceneImages.sky,
    camera.x,
    camera.y,
    960,
    320,
  );
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
  drawHealthBarAsset(context, x, y, current, maximum);
}

function drawEncounterSlotFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.strokeStyle = "#2a0000";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 28, y);
  context.lineTo(x + 36, y + 8);
  context.lineTo(x + 36, y + 35);
  context.lineTo(x + 8, y + 35);
  context.lineTo(x, y + 27);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawEncounterArrow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  context.save();
  context.fillStyle = "#080b14";
  context.beginPath();
  context.moveTo(x, y - 11);
  context.lineTo(x + 11, y);
  context.lineTo(x, y + 11);
  context.closePath();
  context.fill();
  context.restore();
}

function drawClippedLifespanFill(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number,
  ratio: number,
): void {
  drawClippedLifespanFillAsset(
    context,
    atlas.uiImages["lifespan-fill"],
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    ratio,
  );
}

function drawClippedHealthFill(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  frameX: number,
  frameY: number,
  ratio: number,
): void {
  drawClippedHealthFillAsset(
    context,
    atlas.uiImages["hp-fill"],
    frameX,
    frameY,
    ratio,
  );
}

function drawLifeBar(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  camera: Readonly<GameObservation["camera"]>,
  lifespan: Readonly<GameObservation["lifespan"]>,
): void {
  const ratio = clamp((lifespan.whole + lifespan.fraction / 100) / 100, 0, 1);
  const x = camera.x + 160;
  const y = camera.y + 10;
  drawClippedLifespanFill(context, atlas, x, y, 309, 14, ratio);
  drawUiImage(context, atlas, "lifespan-frame", x, y, 309, 14);
  // These fields mirror InterfaceLifespan2's separate Calibri text fields.
  // Their baselines account for each font's ascent so the visible tops sit
  // around the center of the 14px lifespan frame.
  drawOutlinedText(context, "LIFESPAN", x + 57, y + 21, {
    font: `700 20px ${CANVAS_FONT_FAMILIES.body}`,
    align: "center",
    lineWidth: 2,
  });
  drawOutlinedText(context, String(lifespan.whole), x + 260, y + 29, {
    font: `700 32px ${CANVAS_FONT_FAMILIES.body}`,
    align: "right",
    lineWidth: 3,
  });
  drawOutlinedText(
    context,
    String(lifespan.fraction).padStart(2, "0"),
    x + 270,
    y + 21,
    {
      font: `700 20px ${CANVAS_FONT_FAMILIES.body}`,
      align: "center",
      lineWidth: 2,
    },
  );
  drawOutlinedText(context, "%", x + 294, y + 28, {
    font: `700 30px ${CANVAS_FONT_FAMILIES.body}`,
    align: "center",
    lineWidth: 3,
  });
}

function drawEncounterQueue(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
): void {
  const x = observation.camera.x + 298;
  const y = observation.camera.y + 44;
  const slotWidth = 46;
  const current = observation.encounters.current;
  const entries = observation.encounters.upcoming.slice(0, 4);
  const queueItems = encounterQueueItems(observation);
  drawEncounterSlotFrame(context, x - 1, y);
  if (current !== null) {
    const currentItem = queueItems[0];
    if (currentItem !== undefined) {
      drawUiImage(
        context,
        atlas,
        currentItem.imageId,
        currentItem.x,
        currentItem.y,
      );
    }
    if (entries.length > 0) {
      drawEncounterArrow(context, x + 38, y + 18);
    }
    if (current.kind === "shop" && currentItem !== undefined) {
      drawOutlinedText(
        context,
        `${formatNumber(currentItem.price ?? current.cachedPrice)}G`,
        currentItem.x + 17,
        y + 52,
        {
          font: `600 10px ${CANVAS_FONT_FAMILIES.serifSmall}`,
          align: "center",
          lineWidth: 2,
        },
      );
    }
  }
  entries.forEach((entry, index) => {
    const itemIndex = current === null ? index : index + 1;
    const item = queueItems[itemIndex];
    if (item !== undefined) {
      drawUiImage(context, atlas, item.imageId, item.x, item.y);
    }
    if (index < entries.length - 1) {
      drawEncounterArrow(context, x + 38 + index * slotWidth, y + 18);
    }
    if (entry.kind === "shop" && item !== undefined) {
      drawOutlinedText(
        context,
        `${formatNumber(item.price ?? entry.cachedPrice)}G`,
        item.x + 17,
        y + 52,
        {
          font: `600 10px ${CANVAS_FONT_FAMILIES.serifSmall}`,
          align: "center",
          lineWidth: 2,
        },
      );
    }
  });
  drawOutlinedText(context, "Now", x + 4, y + 4, {
    font: `600 11px ${CANVAS_FONT_FAMILIES.serifSmall}`,
    align: "center",
    lineWidth: 2,
  });
  drawOutlinedText(context, "Next", x + 50, y + 4, {
    font: `600 11px ${CANVAS_FONT_FAMILIES.serifSmall}`,
    align: "center",
    lineWidth: 2,
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

  context.save();
  context.beginPath();
  context.rect(camera.x, y, 112, 69);
  context.clip();
  drawUiImage(context, atlas, "portrait", camera.x - 1, y, 116, 69);
  context.restore();

  const hpRatio =
    observation.player.hp.maximum <= 0
      ? 0
      : clamp(
          observation.player.hp.current / observation.player.hp.maximum,
          0,
          1,
        );
  const hpX = camera.x + 112;
  const hpY = y + 34;
  drawClippedHealthFill(context, atlas, hpX, hpY - 2, hpRatio);
  drawUiImage(context, atlas, "hp-frame", hpX, hpY - 2, 101, 13);
  drawOutlinedText(context, "HP", hpX + 7, hpY + 4, {
    font: `700 9px ${CANVAS_FONT_FAMILIES.displayMedium}`,
    lineWidth: 2,
  });
  drawOutlinedText(
    context,
    `${formatNumber(observation.player.hp.current)}/${formatNumber(observation.player.hp.maximum)}`,
    hpX + 100,
    hpY + 17,
    {
      font: `700 10px ${CANVAS_FONT_FAMILIES.displayMedium}`,
      align: "right",
      lineWidth: 2,
    },
  );

  const inventoryItem = observation.player.inventory.item;
  const equipmentLabels: readonly string[] = [
    `${observation.player.weapon.name} [${formatNumber(observation.player.weapon.attack)} ATK]`,
    observation.player.armor.name,
    inventoryItem === null ? "—" : itemName(inventoryItem),
  ];
  const iconPlacements = statusIconPlacements(observation, y);
  equipmentLabels.forEach((label, index) => {
    const placement = iconPlacements[index];
    if (placement === undefined) return;
    if (placement.imageId !== null) {
      drawUiImage(
        context,
        atlas,
        placement.imageId,
        placement.x,
        placement.y,
        16,
        16,
      );
    }
    drawOutlinedText(context, label, placement.x + 17, placement.y + 12, {
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

function drawContextPrompt(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  pointer: WorldPoint | undefined,
): void {
  const groundY =
    observation.camera.y + observation.camera.height * GROUND_RATIO;
  const current = observation.encounters.current;
  const promptMode = contextPromptMode(observation);
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

  if (promptMode === "shop" && current?.kind === "shop") {
    drawActionPointer(context, atlas, observation, x, y);
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
      `${formatNumber(current.cachedPrice)}G`,
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
    promptMode === "item" &&
    observation.battle !== null &&
    observation.player.inventory.item !== null
  ) {
    drawActionPointer(context, atlas, observation, x, y);
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
      itemDescription(observation.player.inventory.item).replace(
        /\. Usable during battle\.$/,
        "",
      ),
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
  drawPrompt = true,
): void {
  drawGoldAndLifespan(context, atlas, observation);
  drawBottomHud(context, atlas, observation);
  if (drawPrompt) {
    drawContextPrompt(context, atlas, observation, pointer);
  }
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

  return calculateEffectAnchor(event, {
    camera,
    groundY,
    heroX,
    enemyX,
    encounterX,
  });
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
  return drawOriginalHitEffectAsset(context, atlas.effectImages, point, age);
}

function drawOriginalClickEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  point: WorldPoint,
  age: number,
): boolean {
  return drawOriginalClickEffectAsset(
    context,
    atlas.clickEffectFrames,
    point,
    age,
  );
}

function drawOriginalActionEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  effect: OriginalActionEffectId,
  point: WorldPoint,
  age: number,
): boolean {
  return drawOriginalActionEffectAsset(
    context,
    atlas.actionEffectFrames[effect],
    point,
    age,
  );
}

function drawOriginalFlashEffect(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  camera: Readonly<GameObservation["camera"]>,
  age: number,
): boolean {
  return drawOriginalFlashEffectAsset(
    context,
    atlas.flashEffectFrames,
    camera,
    age,
  );
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
  const originalVisual = originalEventVisual(effect.event);
  if (effect.clickAnchor !== undefined) {
    drawOriginalClickEffect(
      context,
      atlas,
      effect.clickAnchor,
      clickEffectAge(frame, effect),
    );
  }
  switch (effect.event.type) {
    case "combat-hit":
      drawOriginalHitEffect(context, atlas, point, age);
      drawFloatingText(
        context,
        `${formatNumber(effect.event.damage)}${effect.event.critical ? "!!" : ""}`,
        point,
        age,
        lifetime,
        {
          fill: effect.event.critical ? "#ffe9a6" : "#f7f1df",
          font: `700 14px ${CANVAS_FONT_FAMILIES.compact}`,
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
      break;
    case "shop-purchased": {
      if (originalVisual === "flash") {
        if (age < ORIGINAL_FLASH_EFFECT_LIFETIME) {
          drawOriginalFlashEffect(context, atlas, frame.current.camera, age);
        }
        break;
      }
      if (originalVisual === "buy" || originalVisual === "upgrade") {
        drawOriginalActionEffect(context, atlas, originalVisual, point, age);
      }
      if (
        effect.event.shop === "armorsmith" ||
        effect.event.shop === "bladesmith"
      ) {
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
      }
      break;
    }
    case "battle-reward":
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
      break;
    case "item-used":
      if (originalVisual === "item") {
        drawOriginalActionEffect(context, atlas, originalVisual, point, age);
      }
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
  drawClippedHealthFill(context, atlas, hpX + 23, hpY + 43, hpRatio);
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

  const [cropX, cropY, cropWidth, cropHeight] = tutorialLifespanCrop(
    observation.camera,
  );
  drawUiImage(
    context,
    atlas,
    "tutorial-lifespan-crop",
    cropX,
    cropY,
    cropWidth,
    cropHeight,
  );
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

function drawSessionOver(
  context: CanvasRenderingContext2D,
  atlas: VisualAtlas,
  observation: Readonly<GameObservation>,
  pointer: WorldPoint | undefined,
  animationProgress: number,
): void {
  const camera = observation.camera;
  const progress = clamp(animationProgress, 0, 1);
  const topBandY = interpolate(
    camera.y + SESSION_OVER_TOP_START_OFFSET,
    camera.y + SESSION_OVER_TOP_END_OFFSET,
    progress,
  );
  const bottomBandY = interpolate(
    camera.y + SESSION_OVER_BOTTOM_START_OFFSET,
    camera.y + SESSION_OVER_BOTTOM_END_OFFSET,
    progress,
  );
  context.save();
  context.fillStyle = "#000000";
  context.fillRect(camera.x, topBandY, camera.width, SESSION_OVER_BAND_HEIGHT);
  context.fillRect(
    camera.x,
    bottomBandY,
    camera.width,
    camera.y + camera.height - bottomBandY,
  );
  context.restore();

  if (progress >= 1) {
    drawOutlinedText(
      context,
      "SESSION OVER",
      camera.x + camera.width / 2,
      camera.y + 32,
      {
        font: `700 28px ${CANVAS_FONT_FAMILIES.displayMedium}`,
        align: "center",
        fill: "#080b14",
        stroke: "#f7f1df",
        lineWidth: 2,
      },
    );
    drawOutlinedText(
      context,
      observation.lifecycle.terminalReason === "combat"
        ? "You are killed by the Enemy."
        : "Your lifespan reaches 0%",
      camera.x + 12,
      camera.y + 300,
      {
        font: `700 16px ${CANVAS_FONT_FAMILIES.displayMedium}`,
        fill: "#080b14",
        stroke: "#f7f1df",
        lineWidth: 2,
      },
    );
    drawOutlinedText(
      context,
      "Protip #17 Keep losing? Try again.",
      camera.x + camera.width - 12,
      camera.y + 300,
      {
        font: `700 11px ${CANVAS_FONT_FAMILIES.compact}`,
        align: "right",
        fill: "#f7f1df",
        stroke: "#080b14",
        lineWidth: 2,
      },
    );
  }

  if (pointer !== undefined) {
    const pointerPosition = sessionOverPointerPosition(pointer);
    drawUiImage(
      context,
      atlas,
      "session-over-pointer",
      pointerPosition.x,
      pointerPosition.y,
    );
  }
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
  drawScenery(
    context,
    camera,
    distance,
    atlas.sceneImages,
    current?.kind === "shop" ? x : null,
    groundY,
  );
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
      groundY + (reducedMotion ? 0 : animation.runningY()),
      pose(animation.hero),
    );
  } else {
    const deathStaggerX = (id: "hero" | "enemy"): number =>
      reducedMotion ? 0 : animation.deathStaggerX(id);
    const heroX =
      (battleActorX(
        frame,
        "hero",
        animation.runningX(frame.previous.distance),
      ) ?? camera.x + HERO_RUNNING_X) + deathStaggerX("hero");
    const enemyX =
      (battleActorX(frame, "enemy") ?? camera.x + 390) + deathStaggerX("enemy");
    drawHero(context, atlas, heroX, groundY, pose(animation.hero));
    if (animation.enemy !== undefined) {
      drawEnemy(context, atlas, enemyX, groundY, pose(animation.enemy));
    }
    drawHealthBar(
      context,
      enemyX,
      groundY - 70,
      battle.enemy.currentHp,
      battle.enemy.maximumHp,
    );
  }

  if (
    current !== null &&
    x !== null &&
    current.kind === "battle" &&
    battle === null
  ) {
    if (animation.enemy !== undefined) {
      drawEnemy(context, atlas, x, groundY, pose(animation.enemy));
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
  readonly #diagnostics: CanvasDiagnostics;
  readonly #effects = new CanvasEffectTracker();
  #lastDrawnVisualSignature: string | undefined;
  #backgroundLayer: HTMLCanvasElement | undefined;
  #backgroundLayerKey: string | undefined;
  #pointerWorld: WorldPoint | undefined;
  #sessionOverAnimationStep: number | undefined;
  #sessionOverAnimationProgress = 1;
  #sessionOverAnimationFrame: number | undefined;

  constructor(canvas: HTMLCanvasElement, pack?: VisualAssetPack) {
    this.#canvas = canvas;
    this.#diagnostics = new CanvasDiagnostics(canvas);
    const resources = createCanvasResources((change) => {
      if (change.type === "assets") {
        this.#diagnostics.setAssetStatus(change.status);
      } else {
        this.#diagnostics.setFontStatus(change.status);
      }
      this.#lastDrawnVisualSignature = undefined;
      this.#draw();
    }, pack);
    this.#atlas = resources.atlas;
    this.#diagnostics.initialize(
      resources.atlas.status,
      resources.fontStatus,
      resources.atlas.treatment,
    );
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
  }

  /** Disables optional visual effects without changing public game state. */
  setReducedMotion(reducedMotion: boolean): void {
    if (this.#reducedMotion === reducedMotion) return;
    this.#reducedMotion = reducedMotion;
    if (reducedMotion && this.#sessionOverAnimationFrame !== undefined) {
      this.#cancelSessionOverAnimation();
      this.#sessionOverAnimationProgress = 1;
    }
    this.#diagnostics.setReducedMotion(reducedMotion);
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
    this.#effects.prune(normalizedFrame);
    const visibleEffects = this.#reducedMotion
      ? NO_VISUAL_EFFECTS
      : this.#effects.activeEffects;
    this.#diagnostics.updateFrame(
      normalizedFrame,
      visibleEffects.map(({ event }) => event.type),
      this.#effects.sequence,
      this.#atlas.status,
    );
    if (redrawRequired) {
      const visualSignature = visualFrameSignature(
        normalizedFrame,
        visibleEffects.map(({ key }) => key),
        this.#atlas.status,
      );
      if (visualSignature !== this.#lastDrawnVisualSignature) {
        this.#draw(visualSignature);
      }
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
    context.imageSmoothingEnabled =
      this.#atlas.treatment.filtering === "linear";
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
    transition: Pick<PresentationFrame, "previous" | "current" | "events">,
    runningX = this.#animation.runningX(transition.current.distance),
  ): void {
    this.#updateSessionOverAnimation(transition.previous, transition.current);
    const frame = Object.freeze({
      previous: transition.previous,
      current: transition.current,
      interpolation: 1,
      events: transition.events,
    });
    this.#effects.register(frame, (event, key) =>
      Object.freeze({
        event,
        key,
        startActiveTicks: transition.current.activeTicks,
        anchor: effectAnchor(frame, event, runningX),
        clickAnchor:
          event.type === "shop-purchased" || event.type === "item-used"
            ? (this.#pointerWorld ?? effectAnchor(frame, event, runningX))
            : undefined,
        message:
          eventContextMessage(event, transition.current, transition.previous) ??
          undefined,
      }),
    );
  }

  #updateSessionOverAnimation(
    previous: Readonly<GameObservation>,
    current: Readonly<GameObservation>,
  ): void {
    if (current.lifecycle.phase === "ended") {
      if (
        previous.lifecycle.phase !== "ended" &&
        this.#sessionOverAnimationStep !== current.steps
      ) {
        this.#beginSessionOverAnimation(current.steps);
      }
      return;
    }

    if (this.#sessionOverAnimationStep !== undefined) {
      this.#cancelSessionOverAnimation();
      this.#sessionOverAnimationStep = undefined;
      this.#sessionOverAnimationProgress = 1;
    }
  }

  #beginSessionOverAnimation(step: number): void {
    this.#cancelSessionOverAnimation();
    this.#sessionOverAnimationStep = step;
    if (this.#reducedMotion) {
      this.#sessionOverAnimationProgress = 1;
      return;
    }

    const startedAt = performance.now();
    this.#sessionOverAnimationProgress = 0;
    const animate = (now: number): void => {
      this.#sessionOverAnimationProgress = clamp(
        (now - startedAt) / SESSION_OVER_ANIMATION_DURATION_MS,
        0,
        1,
      );
      this.#draw();
      if (this.#sessionOverAnimationProgress >= 1) {
        this.#sessionOverAnimationFrame = undefined;
        return;
      }
      this.#sessionOverAnimationFrame = requestAnimationFrame(animate);
    };
    this.#sessionOverAnimationFrame = requestAnimationFrame(animate);
  }

  #cancelSessionOverAnimation(): void {
    if (this.#sessionOverAnimationFrame !== undefined) {
      cancelAnimationFrame(this.#sessionOverAnimationFrame);
      this.#sessionOverAnimationFrame = undefined;
    }
  }

  #draw(expectedVisualSignature?: string): void {
    const context = this.#canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D is unavailable");
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled =
      this.#atlas.treatment.filtering === "linear";
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
    this.#diagnostics.updateProjection(
      camera,
      viewport,
      this.#frame.interpolation,
    );

    const backgroundLayer = this.#ensureBackgroundLayer(
      this.#frame,
      projection,
    );
    context.drawImage(backgroundLayer, 0, 0);

    context.save();
    context.beginPath();
    context.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    context.clip();
    context.translate(viewport.x, viewport.y);
    context.scale(projection.scale, projection.scale);
    context.translate(-camera.x, -camera.y);
    const visibleEffects = this.#reducedMotion
      ? NO_VISUAL_EFFECTS
      : this.#effects.activeEffects;
    const ended = this.#frame.current.lifecycle.phase === "ended";
    if (ended) {
      drawDynamicWorld(
        context,
        this.#frame,
        this.#atlas,
        this.#animation,
        this.#reducedMotion,
      );
      drawGameplayHud(
        context,
        this.#frame.current,
        this.#frame.previous,
        this.#atlas,
        this.#frame.events,
        undefined,
        this.#effects.latestMessage(this.#frame),
        false,
      );
      drawSessionOver(
        context,
        this.#atlas,
        this.#frame.current,
        this.#pointerWorld,
        this.#sessionOverAnimationProgress,
      );
    } else {
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
          this.#effects.latestMessage(this.#frame),
        );
      }
    }
    context.restore();
    this.#lastDrawnVisualSignature =
      expectedVisualSignature ??
      visualFrameSignature(
        this.#frame,
        visibleEffects.map(({ key }) => key),
        this.#atlas.status,
      );

    const interpolatedDistance = interpolate(
      this.#frame.previous.distance,
      this.#frame.current.distance,
      this.#frame.interpolation,
    );
    this.#diagnostics.setInterpolatedDistance(interpolatedDistance);
  }
}
