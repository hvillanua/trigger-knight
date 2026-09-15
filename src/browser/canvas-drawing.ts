import type {
  GameEvent,
  GameObservation,
  InventoryItemId,
  ShopId,
} from "../application/contracts.js";
import type {
  OriginalActionEffectId,
  OriginalEffectImageId,
  OriginalSceneAssetId,
  OriginalUiImageId,
} from "./visual-atlas.js";

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface MovingBackgroundLayer {
  readonly id: "mountains" | "ground";
  readonly speed: number;
  readonly y: number;
  readonly height: number;
}

export type SceneImages = Readonly<
  Partial<Record<OriginalSceneAssetId, HTMLImageElement>>
>;

export interface EncounterQueueItem {
  readonly imageId: OriginalUiImageId;
  readonly x: number;
  readonly y: number;
  readonly price: number | null;
}

export interface EffectAnchorInputs {
  readonly camera: Readonly<GameObservation["camera"]>;
  readonly groundY: number;
  readonly heroX: number;
  readonly enemyX: number;
  readonly encounterX: number;
}

export interface StatusIconPlacement {
  readonly imageId: OriginalUiImageId | null;
  readonly x: number;
  readonly y: number;
}

const BACKGROUND_TILE_WIDTH = 960;
const BACKGROUND_TILE_OVERLAP = 1;
const ORIGINAL_ACTION_EFFECT_SCALE = 1.5;
const ORIGINAL_HIT_FRAME_IDS: readonly OriginalEffectImageId[] = Object.freeze([
  "hit-1",
  "hit-2",
  "hit-3",
  "hit-4",
  "hit-5",
  "hit-6",
  "hit-7",
]);

const SHOP_UI_ICONS: Readonly<Record<ShopId, OriginalUiImageId>> =
  Object.freeze({
    bladesmith: "weapon-event-icon",
    armorsmith: "armor-event-icon",
    "soul-shrine": "shrine-icon",
    pharmacy: "elixir-icon",
    "grims-shop": "divine-edge-icon",
    "voucher-store": "voucher-icon",
  });

const ITEM_UI_ICONS: Readonly<Record<InventoryItemId, OriginalUiImageId>> =
  Object.freeze({
    elixir: "item-stats-icon",
    "divine-edge": "divine-edge-icon",
    "gold-voucher": "voucher-icon",
  });

const ACTION_POINTER_FRAME_STEPS = 12;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function imageReady(
  image: HTMLImageElement | undefined,
): image is HTMLImageElement {
  return image !== undefined && image.complete && image.naturalWidth > 0;
}

/** Draws a UI asset while leaving unavailable artwork absent. */
export function drawUiImageAsset(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  width?: number,
  height?: number,
  alpha = 1,
): boolean {
  if (!imageReady(image)) return false;
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

export function drawSceneImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!imageReady(image)) return false;
  try {
    context.drawImage(image, x, y, width, height);
    return true;
  } catch {
    return false;
  }
}

export function drawMovingBackgroundLayer(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  camera: Readonly<GameObservation["camera"]>,
  distance: number,
  layer: Readonly<MovingBackgroundLayer>,
): void {
  const offset = positiveModulo(distance * layer.speed, BACKGROUND_TILE_WIDTH);
  for (
    let x = camera.x - offset;
    x < camera.x + camera.width;
    x += BACKGROUND_TILE_WIDTH
  ) {
    drawSceneImage(
      context,
      image,
      x,
      camera.y + layer.y,
      BACKGROUND_TILE_WIDTH + BACKGROUND_TILE_OVERLAP,
      layer.height,
    );
  }
}

export function drawOriginalBuilding(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
): boolean {
  if (!imageReady(image)) return false;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  try {
    context.drawImage(image, x - width / 2, groundY - height, width, height);
    return true;
  } catch {
    return false;
  }
}

/** Keeps the scene order explicit: mountains, encounter building, ground. */
export function drawScenery(
  context: CanvasRenderingContext2D,
  camera: Readonly<GameObservation["camera"]>,
  distance: number,
  images: SceneImages,
  buildingX: number | null,
  groundY: number,
): void {
  drawMovingBackgroundLayer(context, images.mountains, camera, distance, {
    id: "mountains",
    speed: 0.18,
    y: 82,
    height: 120,
  });
  if (buildingX !== null) {
    drawOriginalBuilding(context, images.building, buildingX, groundY);
  }
  drawMovingBackgroundLayer(context, images.ground, camera, distance, {
    id: "ground",
    speed: 1,
    y: 164,
    height: 188,
  });
}

export function drawHealthBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  current: number,
  maximum: number,
): void {
  const ratio = maximum <= 0 ? 0 : clamp(current / maximum, 0, 1);
  context.save();
  context.fillStyle = "#7e0101";
  context.fillRect(x - 25, y - 3, 50, 6);
  context.fillStyle = "#ffff00";
  context.fillRect(x - 25, y - 3, 50 * ratio, 6);
  context.strokeStyle = "#545401";
  context.lineWidth = 1;
  context.strokeRect(x - 25.5, y - 3.5, 51, 7);
  context.restore();
}

export function drawClippedLifespanFill(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number,
  ratio: number,
): void {
  const horizontalScale = frameWidth / 309;
  const verticalScale = frameHeight / 14;
  const sourceFillWidth = 305;
  const sourceFillHeight = 10;
  const fillWidth = sourceFillWidth * horizontalScale * clamp(ratio, 0, 1);
  const fillHeight = sourceFillHeight * verticalScale;
  if (fillWidth <= 0) return;

  context.save();
  context.beginPath();
  // InterfaceLifespan2 masks the fill with its 305px horizontal rectangle;
  // the diagonal ends come from the staged fill bitmap itself.
  context.rect(
    frameX + 2 * horizontalScale,
    frameY,
    sourceFillWidth * horizontalScale,
    frameHeight,
  );
  context.clip();
  context.beginPath();
  context.rect(
    frameX + 2 * horizontalScale,
    frameY + 2 * verticalScale,
    fillWidth,
    fillHeight,
  );
  context.clip();
  drawUiImageAsset(
    context,
    image,
    frameX + 2 * horizontalScale,
    frameY + 2 * verticalScale,
    sourceFillWidth * horizontalScale,
    fillHeight,
  );
  context.restore();
}

export function drawClippedHealthFill(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  frameX: number,
  frameY: number,
  ratio: number,
): void {
  const fillWidth = 97 * clamp(ratio, 0, 1);
  if (fillWidth <= 0) return;

  context.save();
  context.beginPath();
  context.moveTo(frameX + 5, frameY + 3);
  context.lineTo(frameX + 89, frameY + 3);
  context.lineTo(frameX + 96, frameY + 10);
  context.lineTo(frameX + 10, frameY + 10);
  context.closePath();
  context.clip();
  drawUiImageAsset(context, image, frameX + 2, frameY + 2, fillWidth, 9);
  context.restore();
}

type QueueEncounter =
  | NonNullable<GameObservation["encounters"]["current"]>
  | GameObservation["encounters"]["upcoming"][number];

function encounterImageId(encounter: QueueEncounter): OriginalUiImageId {
  return encounter.kind === "shop"
    ? SHOP_UI_ICONS[encounter.shop]
    : "monster-icon";
}

function encounterPrice(encounter: QueueEncounter): number | null {
  return encounter.kind === "shop" ? encounter.cachedPrice : null;
}

/** Maps public encounter data to the icon and slot coordinates drawn by the HUD. */
export function encounterQueueItems(
  observation: Readonly<GameObservation>,
): readonly EncounterQueueItem[] {
  const x = observation.camera.x + 298;
  const y = observation.camera.y + 44;
  const slotWidth = 46;
  const current = observation.encounters.current;
  const entries = observation.encounters.upcoming.slice(0, 4);
  const encounters: readonly QueueEncounter[] = [
    ...(current === null ? [] : [current]),
    ...entries,
  ];
  return encounters.map((encounter, index) => ({
    imageId: encounterImageId(encounter),
    x: x + (current === null ? index + 1 : index) * slotWidth,
    y,
    price: encounterPrice(encounter),
  }));
}

export function actionPointerImageId(
  observation: Readonly<GameObservation>,
): "pointer" | "pointer-click" {
  return Math.floor(observation.steps / ACTION_POINTER_FRAME_STEPS) % 2 === 0
    ? "pointer"
    : "pointer-click";
}

export function tutorialLifespanCrop(
  camera: Readonly<GameObservation["camera"]>,
): readonly [x: number, y: number, width: number, height: number] {
  return [camera.x + 298, camera.y + 191, 150, 80];
}

/** Maps the compact bottom HUD rows to their public icon positions. */
export function statusIconPlacements(
  observation: Readonly<GameObservation>,
  bottomHudY: number,
): readonly StatusIconPlacement[] {
  const item = observation.player.inventory.item;
  const imageIds: readonly (OriginalUiImageId | null)[] = [
    "weapon-stats-icon",
    "armor-stats-icon",
    item === null ? null : ITEM_UI_ICONS[item],
  ];
  return imageIds.map((imageId, index) => ({
    imageId,
    x: observation.camera.x + 235 + index * 20,
    y: bottomHudY + 15 + index * 16,
  }));
}

export type ContextPromptMode = "shop" | "item" | "none";

export function contextPromptMode(
  observation: Readonly<GameObservation>,
): ContextPromptMode {
  const current = observation.encounters.current;
  if (current?.kind === "shop") {
    return observation.actions.canPurchaseCurrentEncounter ? "shop" : "none";
  }
  if (
    observation.battle !== null &&
    observation.player.inventory.item !== null
  ) {
    return observation.actions.canUseCarriedItem ? "item" : "none";
  }
  return "none";
}

export function sessionOverPointerPosition(point: WorldPoint): WorldPoint {
  return { x: point.x - 4, y: point.y - 2 };
}

export type OriginalEventVisual =
  "hit" | "flash" | OriginalActionEffectId | null;

export function originalEventVisual(event: GameEvent): OriginalEventVisual {
  switch (event.type) {
    case "combat-hit":
    case "combat-lethal-hit":
      return "hit";
    case "shop-purchased":
      return event.shop === "soul-shrine"
        ? "flash"
        : event.shop === "armorsmith" || event.shop === "bladesmith"
          ? "upgrade"
          : "buy";
    case "item-used":
      return "item";
    default:
      return null;
  }
}

export function calculateEffectAnchor(
  event: GameEvent,
  inputs: Readonly<EffectAnchorInputs>,
): WorldPoint {
  switch (event.type) {
    case "combat-hit":
    case "combat-lethal-hit":
      return {
        x: event.target === "hero" ? inputs.heroX : inputs.enemyX,
        y: inputs.groundY - 53,
      };
    case "combat-phase-changed":
      return {
        x: event.actor === "hero" ? inputs.heroX : inputs.enemyX,
        y: inputs.groundY - 50,
      };
    case "battle-started":
      return { x: inputs.enemyX, y: inputs.groundY - 54 };
    case "encounter-promoted":
      return { x: inputs.encounterX, y: inputs.groundY - 40 };
    case "shop-purchased":
    case "item-used":
      return { x: inputs.heroX, y: inputs.groundY - 30 };
    case "purchase-rejected":
    case "shop-departed":
      return { x: inputs.encounterX, y: inputs.groundY - 50 };
    case "item-use-rejected":
      return { x: inputs.heroX, y: inputs.groundY - 55 };
    case "battle-reward":
    case "equipment-discovered":
    case "achievement-unlocked":
    case "lifespan-death":
    case "run-ended":
      return { x: inputs.heroX, y: inputs.groundY - 58 };
    case "pause-toggled":
    case "tutorial-dismissed":
    case "step-advanced":
      return {
        x: inputs.camera.x + inputs.camera.width / 2,
        y: inputs.camera.y + 108,
      };
  }
}

export function drawOriginalHitEffect(
  context: CanvasRenderingContext2D,
  images: Readonly<Partial<Record<OriginalEffectImageId, HTMLImageElement>>>,
  point: WorldPoint,
  age: number,
): boolean {
  // FXHit's eighth timeline frame is intentionally blank.
  if (age >= ORIGINAL_HIT_FRAME_IDS.length) return true;
  const frameIndex = Math.min(
    ORIGINAL_HIT_FRAME_IDS.length - 1,
    Math.max(0, Math.floor(age)),
  );
  const image = images[ORIGINAL_HIT_FRAME_IDS[frameIndex]!];
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

export function drawOriginalTimelineFrame(
  context: CanvasRenderingContext2D,
  frames: readonly (HTMLImageElement | undefined)[],
  point: WorldPoint,
  age: number,
  scale: number,
): boolean {
  if (age >= frames.length) return true;
  const frameIndex = Math.min(frames.length - 1, Math.max(0, Math.floor(age)));
  const image = frames[frameIndex];
  if (!imageReady(image)) return false;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.save();
  try {
    context.drawImage(
      image,
      point.x - width / 2,
      point.y - height / 2,
      width,
      height,
    );
  } catch {
    context.restore();
    return false;
  }
  context.restore();
  return true;
}

export function drawOriginalClickEffect(
  context: CanvasRenderingContext2D,
  frames: readonly (HTMLImageElement | undefined)[],
  point: WorldPoint,
  age: number,
): boolean {
  return drawOriginalTimelineFrame(context, frames, point, age, 1);
}

export function drawOriginalActionEffect(
  context: CanvasRenderingContext2D,
  frames: readonly (HTMLImageElement | undefined)[],
  point: WorldPoint,
  age: number,
): boolean {
  return drawOriginalTimelineFrame(
    context,
    frames,
    point,
    age,
    ORIGINAL_ACTION_EFFECT_SCALE,
  );
}

export function drawOriginalFlashEffect(
  context: CanvasRenderingContext2D,
  frames: readonly (HTMLImageElement | undefined)[],
  camera: Readonly<GameObservation["camera"]>,
  age: number,
): boolean {
  return drawOriginalTimelineFrame(
    context,
    frames,
    {
      x: camera.x + camera.width / 2,
      y: camera.y + camera.height / 2,
    },
    age,
    1,
  );
}
