import type { ActorSpriteId } from "./sprite-animation.js";

import type {
  EnemyId,
  InventoryItemId,
  ShopId,
} from "../application/contracts.js";
import {
  ORIGINAL_VISUAL_ASSET_PACK,
  originalAssetPaths,
  type VisualAssetPack,
  type VisualImageSource,
} from "./visual-assets.js";

import type { PixelDensity } from "./visual-assets.js";
export type { PixelDensity } from "./visual-assets.js";

interface CachedVisualImage {
  readonly url: string;
  readonly imageConstructor: typeof Image;
  readonly promise: Promise<HTMLImageElement>;
}

const VISUAL_IMAGE_CACHE_KEY = Symbol.for("trigger-knight.visual-image-cache");

// Keep unchanged decoded images alive when Vite replaces this module during HMR.
function visualImageCache(): Map<string, CachedVisualImage> {
  const host = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  const cached = host[VISUAL_IMAGE_CACHE_KEY];
  if (cached instanceof Map) {
    return cached as Map<string, CachedVisualImage>;
  }
  const cache = new Map<string, CachedVisualImage>();
  host[VISUAL_IMAGE_CACHE_KEY] = cache;
  return cache;
}

function visualImageCacheKey(url: string): string {
  const queryStart = url.indexOf("?");
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

function loadVisualImage(url: string): Promise<HTMLImageElement> {
  const ImageConstructor = globalThis.Image;
  const cache = visualImageCache();
  const key = visualImageCacheKey(url);
  const cached = cache.get(key);
  if (cached?.url === url && cached.imageConstructor === ImageConstructor) {
    return cached.promise;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new ImageConstructor();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image asset failed: ${url}`));
    image.src = url;
  });
  cache.set(key, { url, imageConstructor: ImageConstructor, promise });
  void promise.catch(() => {
    const entry = cache.get(key);
    if (entry?.promise === promise) cache.delete(key);
  });
  return promise;
}

export interface VisualImage {
  readonly image: HTMLImageElement;
  readonly pixelDensity: PixelDensity;
}

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

export type OriginalSceneAssetId = "sky" | "ground" | "mountains" | "building";

export type OriginalEffectImageId =
  "hit-1" | "hit-2" | "hit-3" | "hit-4" | "hit-5" | "hit-6" | "hit-7";

export type OriginalActionEffectId = "buy" | "item" | "upgrade";

export type OriginalUiImageId =
  | "parchment"
  | "bottom-strip"
  | "message-strip"
  | "lifespan-fill"
  | "lifespan-frame"
  | "tutorial-lifespan-crop"
  | "hp-fill"
  | "hp-frame"
  | "portrait"
  | "logo"
  | "gold-bag"
  | "pointer"
  | "pointer-click"
  | "session-over-pointer"
  | "weapon-upgrade-icon"
  | "armor-upgrade-icon"
  | "shrine-icon"
  | "elixir-icon"
  | "divine-edge-icon"
  | "voucher-icon"
  | "weapon-event-icon"
  | "armor-event-icon"
  | "monster-icon"
  | "weapon-stats-icon"
  | "item-stats-icon"
  | "armor-stats-icon";

type AssetSource = VisualImageSource;

interface VisualAssetSources {
  readonly sprites: Readonly<Record<string, AssetSource>>;
  readonly scenes: Readonly<Record<string, AssetSource>>;
  readonly effects: Readonly<Record<string, AssetSource>>;
  readonly ui: Readonly<Record<string, AssetSource>>;
  readonly clickEffectFrames: readonly AssetSource[];
  readonly actionEffectFrames: Readonly<
    Record<OriginalActionEffectId, readonly AssetSource[]>
  >;
  readonly flashEffectFrames: readonly AssetSource[];
  readonly animationFrames: Readonly<
    Record<ActorSpriteId, readonly AssetSource[]>
  >;
}

export interface VisualStyleUrls {
  readonly parchment: string;
  readonly titleHero: string;
  readonly sky: string;
  readonly skyMask: string;
  readonly logo: string;
  readonly cursor: string;
}

/** Resolves the raster and mask assets used by non-canvas screens. */
export function createVisualStyleUrls(pack: VisualAssetPack): VisualStyleUrls {
  const cursor = pack.image("images/12.png");
  return Object.freeze({
    parchment: pack.image("images/529.jpg").url,
    titleHero: pack.image("images/533.png").url,
    sky: pack.image("images/357.jpg").url,
    skyMask: pack.image("shapes/350.svg").url,
    logo: pack.image("images/268.png").url,
    cursor:
      cursor.pixelDensity === 1
        ? cursor.url
        : ORIGINAL_VISUAL_ASSET_PACK.image("images/12.png").url,
  });
}

function sourceRecord<Key extends string>(
  paths: Readonly<Record<Key, string>>,
  pack: VisualAssetPack,
): Readonly<Record<Key, AssetSource>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(paths).map((id) => [id, pack.image(paths[id as Key])]),
    ),
  ) as Readonly<Record<Key, AssetSource>>;
}

function numberedAssetPaths(prefix: string): readonly string[] {
  return originalAssetPaths(prefix);
}

function numberedAssetSources(
  prefix: string,
  pack: VisualAssetPack,
): readonly AssetSource[] {
  return Object.freeze(
    numberedAssetPaths(prefix).map((path) => pack.image(path)),
  );
}

function sourceUrls<Key extends string>(
  sources: Readonly<Record<Key, AssetSource>>,
): Readonly<Record<Key, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(sources).map((id) => [id, sources[id as Key].url]),
    ),
  ) as Readonly<Record<Key, string>>;
}

function sourceUrlArrays<Key extends string>(
  sources: Readonly<Record<Key, readonly AssetSource[]>>,
): Readonly<Record<Key, readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(sources).map((id) => {
        const entries = sources[id as Key];
        return [id, Object.freeze(entries.map((entry) => entry.url))];
      }),
    ),
  ) as Readonly<Record<Key, readonly string[]>>;
}

const SPRITE_PATHS = Object.freeze({
  hero: "key-sprites/DefineSprite_497_Hero/1.png",
  dragon: "key-sprites/DefineSprite_397_EnemyDragon/1.png",
  goblin: "key-sprites/DefineSprite_421_EnemyGoblin/1.png",
  golem: "key-sprites/DefineSprite_446_EnemyGolem/1.png",
  wolf: "key-sprites/DefineSprite_477_EnemyWolf/1.png",
});

const SCENE_PATHS = Object.freeze({
  sky: "images/357.jpg",
  ground: "images/360.png",
  mountains: "images/363.png",
  building: "images/366.png",
});

const EFFECT_PATHS = Object.freeze({
  "hit-1": "images/119.png",
  "hit-2": "images/121.png",
  "hit-3": "images/123.png",
  "hit-4": "images/125.png",
  "hit-5": "images/127.png",
  "hit-6": "images/129.png",
  "hit-7": "images/131.png",
});

const UI_PATHS = Object.freeze({
  parchment: "images/529.jpg",
  "bottom-strip": "images/200.jpg",
  "message-strip": "images/190.png",
  "lifespan-fill": "images/251.png",
  "lifespan-frame": "images/253.png",
  "tutorial-lifespan-crop": "images/318.jpg",
  "hp-fill": "images/202.png",
  "hp-frame": "images/204.png",
  portrait: "images/194.png",
  logo: "images/268.png",
  "gold-bag": "images/233.png",
  pointer: "images/19.png",
  "pointer-click": "images/21.png",
  "session-over-pointer": "images/12.png",
  "weapon-upgrade-icon": "images/156.png",
  "armor-upgrade-icon": "images/158.png",
  "shrine-icon": "images/172.png",
  "elixir-icon": "images/160.png",
  "divine-edge-icon": "images/162.png",
  "voucher-icon": "images/164.png",
  "weapon-event-icon": "images/168.png",
  "armor-event-icon": "images/170.png",
  "monster-icon": "images/179.png",
  "weapon-stats-icon": "images/197.png",
  "item-stats-icon": "images/198.png",
  "armor-stats-icon": "images/199.png",
});

const ACTION_EFFECT_PREFIXES = Object.freeze({
  buy: "effects/DefineSprite_118_FXBuy/",
  item: "effects/DefineSprite_151_FXItem/",
  upgrade: "effects/DefineSprite_153_FXUpgrade/",
});

const ACTOR_PREFIXES = Object.freeze({
  hero: "key-sprites/DefineSprite_497_Hero/",
  dragon: "key-sprites/DefineSprite_397_EnemyDragon/",
  goblin: "key-sprites/DefineSprite_421_EnemyGoblin/",
  golem: "key-sprites/DefineSprite_446_EnemyGolem/",
  wolf: "key-sprites/DefineSprite_477_EnemyWolf/",
});

function createVisualAssetSources(pack: VisualAssetPack): VisualAssetSources {
  const actionEffectFrames = {
    buy: numberedAssetSources(ACTION_EFFECT_PREFIXES.buy, pack),
    item: numberedAssetSources(ACTION_EFFECT_PREFIXES.item, pack),
    upgrade: numberedAssetSources(ACTION_EFFECT_PREFIXES.upgrade, pack),
  };
  const animationFrames = {
    hero: numberedAssetSources(ACTOR_PREFIXES.hero, pack),
    dragon: numberedAssetSources(ACTOR_PREFIXES.dragon, pack),
    goblin: numberedAssetSources(ACTOR_PREFIXES.goblin, pack),
    golem: numberedAssetSources(ACTOR_PREFIXES.golem, pack),
    wolf: numberedAssetSources(ACTOR_PREFIXES.wolf, pack),
  };
  return Object.freeze({
    sprites: sourceRecord(SPRITE_PATHS, pack),
    scenes: sourceRecord(SCENE_PATHS, pack),
    effects: sourceRecord(EFFECT_PATHS, pack),
    ui: sourceRecord(UI_PATHS, pack),
    clickEffectFrames: numberedAssetSources(
      "effects/DefineSprite_311_MouseEffect/",
      pack,
    ),
    actionEffectFrames,
    flashEffectFrames: numberedAssetSources(
      "effects/DefineSprite_369_Effect-Flash/",
      pack,
    ),
    animationFrames,
  });
}

const ORIGINAL_ASSET_SOURCES = createVisualAssetSources(
  ORIGINAL_VISUAL_ASSET_PACK,
);

export const ORIGINAL_SPRITE_URLS = sourceUrls(ORIGINAL_ASSET_SOURCES.sprites);
export const ORIGINAL_SCENE_ASSET_URLS = sourceUrls(
  ORIGINAL_ASSET_SOURCES.scenes,
);
/** Reviewed frames exported from the original FXHit timeline. */
export const ORIGINAL_EFFECT_IMAGE_URLS = sourceUrls(
  ORIGINAL_ASSET_SOURCES.effects,
);
/** Reviewed interface exports used by the composed browser presentation. */
export const ORIGINAL_UI_IMAGE_URLS = sourceUrls(ORIGINAL_ASSET_SOURCES.ui);
/** Reviewed frames exported from the original MouseEffect click-feedback timeline. */
export const ORIGINAL_CLICK_EFFECT_URLS = Object.freeze(
  ORIGINAL_ASSET_SOURCES.clickEffectFrames.map((source) => source.url),
);
/** Reviewed frames exported from the original purchase and item action timelines. */
export const ORIGINAL_ACTION_EFFECT_URLS = sourceUrlArrays(
  ORIGINAL_ASSET_SOURCES.actionEffectFrames,
);
/** Reviewed frames exported from the original lifespan-restoration flash timeline. */
export const ORIGINAL_FLASH_EFFECT_URLS = Object.freeze(
  ORIGINAL_ASSET_SOURCES.flashEffectFrames.map((source) => source.url),
);
export const ORIGINAL_ANIMATION_URLS = sourceUrlArrays(
  ORIGINAL_ASSET_SOURCES.animationFrames,
);

export type VisualAtlasStatus = "loading" | "ready" | "partial" | "unavailable";

export interface VisualAtlas {
  readonly status: VisualAtlasStatus;
  readonly treatment: VisualAssetPack["treatment"];
  readonly originalImages: Readonly<
    Partial<Record<VisualSpriteId, VisualImage>>
  >;
  readonly originalFrames: Readonly<
    Partial<Record<ActorSpriteId, readonly (VisualImage | undefined)[]>>
  >;
  readonly sceneImages: Readonly<
    Partial<Record<OriginalSceneAssetId, VisualImage>>
  >;
  readonly effectImages: Readonly<
    Partial<Record<OriginalEffectImageId, VisualImage>>
  >;
  readonly clickEffectFrames: Readonly<(VisualImage | undefined)[]>;
  readonly actionEffectFrames: Readonly<
    Record<OriginalActionEffectId, readonly (VisualImage | undefined)[]>
  >;
  readonly flashEffectFrames: Readonly<(VisualImage | undefined)[]>;
  readonly uiImages: Readonly<Partial<Record<OriginalUiImageId, VisualImage>>>;
}

/** Failed or unmapped artwork stays absent. Gameplay never waits for images. */
export function createVisualAtlas(
  onStatusChange: (status: VisualAtlasStatus) => void,
  pack: VisualAssetPack = ORIGINAL_VISUAL_ASSET_PACK,
): VisualAtlas {
  const sources = createVisualAssetSources(pack);
  let status: VisualAtlasStatus =
    typeof Image === "undefined" ? "unavailable" : "loading";
  const originalImages: Partial<Record<VisualSpriteId, VisualImage>> = {};
  const originalFrames: Partial<
    Record<ActorSpriteId, (VisualImage | undefined)[]>
  > = {};
  const sceneImages: Partial<Record<OriginalSceneAssetId, VisualImage>> = {};
  const effectImages: Partial<Record<OriginalEffectImageId, VisualImage>> = {};
  const clickEffectFrames: (VisualImage | undefined)[] = Array.from(
    { length: sources.clickEffectFrames.length },
    () => undefined,
  );
  const actionEffectFrames: Record<
    OriginalActionEffectId,
    (VisualImage | undefined)[]
  > = {
    buy: Array.from(
      { length: sources.actionEffectFrames.buy.length },
      () => undefined,
    ),
    item: Array.from(
      { length: sources.actionEffectFrames.item.length },
      () => undefined,
    ),
    upgrade: Array.from(
      { length: sources.actionEffectFrames.upgrade.length },
      () => undefined,
    ),
  };
  const flashEffectFrames: (VisualImage | undefined)[] = Array.from(
    { length: sources.flashEffectFrames.length },
    () => undefined,
  );
  const uiImages: Partial<Record<OriginalUiImageId, VisualImage>> = {};
  if (status === "loading") {
    let pending =
      Object.values(sources.animationFrames).reduce(
        (total, frames) => total + frames.length,
        0,
      ) +
      Object.keys(sources.scenes).length +
      Object.keys(sources.effects).length +
      sources.clickEffectFrames.length +
      Object.keys(sources.ui).length +
      Object.keys(sources.actionEffectFrames).length +
      (sources.flashEffectFrames.length > 0 ? 1 : 0);
    let loaded = 0;
    let failed = 0;
    let coreSettled = false;
    const load = (
      source: AssetSource,
      save: (image: VisualImage) => void,
    ): void => {
      const settle = (): void => {
        pending -= 1;
        if (pending !== 0) return;
        coreSettled = true;
        status =
          loaded === 0 ? "unavailable" : failed > 0 ? "partial" : "ready";
        onStatusChange(status);
      };
      void loadVisualImage(source.url).then(
        (image) => {
          save(Object.freeze({ image, pixelDensity: source.pixelDensity }));
          loaded += 1;
          settle();
        },
        () => {
          failed += 1;
          settle();
        },
      );
    };
    const loadOptional = (
      source: AssetSource,
      save: (image: VisualImage) => void,
    ): void => {
      void loadVisualImage(source.url).then(
        (image) => {
          save(Object.freeze({ image, pixelDensity: source.pixelDensity }));
          if (coreSettled && status === "ready") onStatusChange(status);
        },
        () => undefined,
      );
    };
    for (const id of Object.keys(sources.animationFrames) as ActorSpriteId[]) {
      const assetSources = sources.animationFrames[id];
      const frames: (VisualImage | undefined)[] = Array.from(
        { length: assetSources.length },
        () => undefined,
      );
      originalFrames[id] = frames;
      assetSources.forEach((source, index) =>
        load(source, (image) => {
          frames[index] = image;
          if (index === 0) originalImages[id] = image;
        }),
      );
    }
    for (const id of Object.keys(sources.scenes) as OriginalSceneAssetId[]) {
      load(sources.scenes[id]!, (image) => {
        sceneImages[id] = image;
      });
    }
    for (const id of Object.keys(sources.effects) as OriginalEffectImageId[]) {
      load(sources.effects[id]!, (image) => {
        effectImages[id] = image;
      });
    }
    sources.clickEffectFrames.forEach((source, index) =>
      load(source, (image) => {
        clickEffectFrames[index] = image;
      }),
    );
    for (const id of Object.keys(sources.ui) as OriginalUiImageId[]) {
      load(sources.ui[id]!, (image) => {
        uiImages[id] = image;
      });
    }
    for (const id of Object.keys(
      sources.actionEffectFrames,
    ) as OriginalActionEffectId[]) {
      const assetSources = sources.actionEffectFrames[id];
      const firstSource = assetSources[0];
      if (firstSource !== undefined) {
        load(firstSource, (image) => {
          actionEffectFrames[id][0] = image;
        });
      }
      assetSources.slice(1).forEach((source, index) =>
        loadOptional(source, (image) => {
          actionEffectFrames[id][index + 1] = image;
        }),
      );
    }
    const firstFlashSource = sources.flashEffectFrames[0];
    if (firstFlashSource !== undefined) {
      load(firstFlashSource, (image) => {
        flashEffectFrames[0] = image;
      });
    }
    sources.flashEffectFrames.slice(1).forEach((source, index) =>
      loadOptional(source, (image) => {
        flashEffectFrames[index + 1] = image;
      }),
    );
  }
  return Object.freeze({
    get status() {
      return status;
    },
    treatment: pack.treatment,
    originalImages,
    originalFrames,
    sceneImages,
    effectImages,
    clickEffectFrames,
    actionEffectFrames,
    flashEffectFrames,
    uiImages,
  });
}
