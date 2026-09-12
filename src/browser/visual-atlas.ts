import type {
  EnemyId,
  InventoryItemId,
  ShopId,
} from "../application/contracts.js";

export type VisualSpriteId =
  | "hero"
  | EnemyId
  | ShopId
  | "weapon"
  | "armor"
  | InventoryItemId
  | "tree"
  | "pine"
  | "rock"
  | "road-marker"
  | "moon"
  | "cloud"
  | "effect"
  | "fence"
  | "spark"
  | "mountain"
  | "sign";

export interface SpriteRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const SPRITE_WIDTH = 64;
const SPRITE_HEIGHT = 96;

function sprite(x: number, y: number): SpriteRect {
  return Object.freeze({
    x,
    y,
    width: SPRITE_WIDTH,
    height: SPRITE_HEIGHT,
  });
}

/** Every visual sprite is authored in the clean-room atlas. */
export const VISUAL_SPRITES: Readonly<Record<VisualSpriteId, SpriteRect>> =
  Object.freeze({
    hero: sprite(0, 0),
    goblin: sprite(64, 0),
    golem: sprite(128, 0),
    wolf: sprite(192, 0),
    dragon: sprite(256, 0),
    tree: sprite(320, 0),
    pine: sprite(384, 0),
    rock: sprite(448, 0),
    bladesmith: sprite(0, 96),
    armorsmith: sprite(64, 96),
    "soul-shrine": sprite(128, 96),
    pharmacy: sprite(192, 96),
    "grims-shop": sprite(256, 96),
    "voucher-store": sprite(320, 96),
    weapon: sprite(384, 96),
    armor: sprite(448, 96),
    elixir: sprite(0, 192),
    "divine-edge": sprite(64, 192),
    "gold-voucher": sprite(128, 192),
    "road-marker": sprite(192, 192),
    moon: sprite(256, 192),
    cloud: sprite(320, 192),
    effect: sprite(384, 192),
    fence: sprite(448, 192),
    spark: sprite(0, 288),
    mountain: sprite(64, 288),
    sign: sprite(128, 288),
  });

export const WORLD_ATLAS_URL = new URL(
  "../assets/world-atlas.svg",
  import.meta.url,
).href;

export type VisualAtlasStatus = "loading" | "ready" | "fallback";

export interface VisualAtlas {
  readonly status: VisualAtlasStatus;
  readonly image: HTMLImageElement | undefined;
}

/** Loads optional artwork without making presentation or gameplay wait for it. */
export function createVisualAtlas(
  onStatusChange: (status: VisualAtlasStatus) => void,
): VisualAtlas {
  let status: VisualAtlasStatus =
    typeof Image === "undefined" ? "fallback" : "loading";
  let image: HTMLImageElement | undefined;

  if (status === "loading") {
    const candidate = new Image();
    candidate.decoding = "async";
    image = candidate;
    candidate.onload = () => {
      status = "ready";
      onStatusChange(status);
    };
    candidate.onerror = () => {
      image = undefined;
      status = "fallback";
      onStatusChange(status);
    };
    candidate.src = WORLD_ATLAS_URL;
  }

  return Object.freeze({
    get status() {
      return status;
    },
    get image() {
      return image;
    },
  });
}
