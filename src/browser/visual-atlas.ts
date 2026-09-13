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

export type OriginalSceneAssetId = "sky" | "ground" | "mountains" | "building";

export type OriginalUiImageId =
  | "parchment"
  | "bottom-strip"
  | "message-strip"
  | "lifespan-fill"
  | "lifespan-frame"
  | "hp-fill"
  | "hp-frame"
  | "portrait"
  | "logo"
  | "gold-bag"
  | "pointer"
  | "pointer-click"
  | "weapon-icon"
  | "armor-icon"
  | "shrine-icon"
  | "elixir-icon"
  | "divine-edge-icon"
  | "voucher-icon";

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

/** Every visual sprite maps to an approved runtime asset or fallback tile. */
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

export const ORIGINAL_SPRITE_URLS: Readonly<
  Partial<Record<VisualSpriteId, string>>
> = Object.freeze({
  hero: new URL(
    "../assets/original/key-sprites/DefineSprite_497_Hero/1.png",
    import.meta.url,
  ).href,
  dragon: new URL(
    "../assets/original/key-sprites/DefineSprite_397_EnemyDragon/1.png",
    import.meta.url,
  ).href,
  goblin: new URL(
    "../assets/original/key-sprites/DefineSprite_421_EnemyGoblin/1.png",
    import.meta.url,
  ).href,
  golem: new URL(
    "../assets/original/key-sprites/DefineSprite_446_EnemyGolem/1.png",
    import.meta.url,
  ).href,
  wolf: new URL(
    "../assets/original/key-sprites/DefineSprite_477_EnemyWolf/1.png",
    import.meta.url,
  ).href,
});

export const ORIGINAL_SCENE_ASSET_URLS: Readonly<
  Record<OriginalSceneAssetId, string>
> = Object.freeze({
  sky: new URL("../assets/original/images/357.jpg", import.meta.url).href,
  ground: new URL("../assets/original/images/360.png", import.meta.url).href,
  mountains: new URL("../assets/original/images/363.png", import.meta.url).href,
  building: new URL("../assets/original/images/366.png", import.meta.url).href,
});

/** Reviewed interface exports used by the composed browser presentation. */
export const ORIGINAL_UI_IMAGE_URLS: Readonly<
  Record<OriginalUiImageId, string>
> = Object.freeze({
  parchment: new URL("../assets/original/images/529.jpg", import.meta.url).href,
  "bottom-strip": new URL("../assets/original/images/200.jpg", import.meta.url)
    .href,
  "message-strip": new URL("../assets/original/images/190.png", import.meta.url)
    .href,
  "lifespan-fill": new URL("../assets/original/images/251.png", import.meta.url)
    .href,
  "lifespan-frame": new URL(
    "../assets/original/images/253.png",
    import.meta.url,
  ).href,
  "hp-fill": new URL("../assets/original/images/202.png", import.meta.url).href,
  "hp-frame": new URL("../assets/original/images/204.png", import.meta.url)
    .href,
  portrait: new URL("../assets/original/images/194.png", import.meta.url).href,
  logo: new URL("../assets/original/images/268.png", import.meta.url).href,
  "gold-bag": new URL("../assets/original/images/233.png", import.meta.url)
    .href,
  pointer: new URL("../assets/original/images/19.png", import.meta.url).href,
  "pointer-click": new URL("../assets/original/images/21.png", import.meta.url)
    .href,
  "weapon-icon": new URL("../assets/original/images/156.png", import.meta.url)
    .href,
  "armor-icon": new URL("../assets/original/images/158.png", import.meta.url)
    .href,
  "shrine-icon": new URL("../assets/original/images/172.png", import.meta.url)
    .href,
  "elixir-icon": new URL("../assets/original/images/198.png", import.meta.url)
    .href,
  "divine-edge-icon": new URL(
    "../assets/original/images/179.png",
    import.meta.url,
  ).href,
  "voucher-icon": new URL("../assets/original/images/164.png", import.meta.url)
    .href,
});

export const WORLD_ATLAS_URL = new URL(
  "../assets/world-atlas.svg",
  import.meta.url,
).href;

export type VisualAtlasStatus = "loading" | "ready" | "fallback";

export interface VisualAtlas {
  readonly status: VisualAtlasStatus;
  readonly image: HTMLImageElement | undefined;
  readonly originalImages: Readonly<
    Partial<Record<VisualSpriteId, HTMLImageElement>>
  >;
  readonly sceneImages: Readonly<
    Partial<Record<OriginalSceneAssetId, HTMLImageElement>>
  >;
  readonly uiImages: Readonly<
    Partial<Record<OriginalUiImageId, HTMLImageElement>>
  >;
}

/** Loads optional artwork without making presentation or gameplay wait for it. */
export function createVisualAtlas(
  onStatusChange: (status: VisualAtlasStatus) => void,
): VisualAtlas {
  let status: VisualAtlasStatus =
    typeof Image === "undefined" ? "fallback" : "loading";
  let image: HTMLImageElement | undefined;
  const originalImages: Partial<Record<VisualSpriteId, HTMLImageElement>> = {};
  const sceneImages: Partial<Record<OriginalSceneAssetId, HTMLImageElement>> =
    {};
  const uiImages: Partial<Record<OriginalUiImageId, HTMLImageElement>> = {};

  if (status === "loading") {
    const originalSpriteEntries = Object.entries(ORIGINAL_SPRITE_URLS) as Array<
      [VisualSpriteId, string]
    >;
    const originalSceneEntries = Object.entries(
      ORIGINAL_SCENE_ASSET_URLS,
    ) as Array<[OriginalSceneAssetId, string]>;
    const originalUiEntries = Object.entries(ORIGINAL_UI_IMAGE_URLS) as Array<
      [OriginalUiImageId, string]
    >;
    let pending =
      1 +
      originalSpriteEntries.length +
      originalSceneEntries.length +
      originalUiEntries.length;
    let fallbackLoaded = false;

    const settle = (): void => {
      pending -= 1;
      if (pending !== 0) return;
      status = fallbackLoaded ? "ready" : "fallback";
      onStatusChange(status);
    };

    const candidate = new Image();
    candidate.decoding = "async";
    image = candidate;
    candidate.onload = () => {
      fallbackLoaded = true;
      settle();
    };
    candidate.onerror = () => {
      image = undefined;
      settle();
    };
    candidate.src = WORLD_ATLAS_URL;

    for (const [spriteId, url] of originalSpriteEntries) {
      const spriteImage = new Image();
      spriteImage.decoding = "async";
      originalImages[spriteId] = spriteImage;
      spriteImage.onload = settle;
      spriteImage.onerror = settle;
      spriteImage.src = url;
    }

    for (const [assetId, url] of originalSceneEntries) {
      const sceneImage = new Image();
      sceneImage.decoding = "async";
      sceneImages[assetId] = sceneImage;
      sceneImage.onload = settle;
      sceneImage.onerror = settle;
      sceneImage.src = url;
    }

    for (const [assetId, url] of originalUiEntries) {
      const uiImage = new Image();
      uiImage.decoding = "async";
      uiImages[assetId] = uiImage;
      uiImage.onload = settle;
      uiImage.onerror = settle;
      uiImage.src = url;
    }
  }

  return Object.freeze({
    get status() {
      return status;
    },
    get image() {
      return image;
    },
    originalImages: Object.freeze(originalImages),
    sceneImages: Object.freeze(sceneImages),
    uiImages: Object.freeze(uiImages),
  });
}
