import type { ActorSpriteId } from "./sprite-animation.js";

import type {
  EnemyId,
  InventoryItemId,
  ShopId,
} from "../application/contracts.js";
import {
  ORIGINAL_ASSET_TREATMENT,
  type AssetTreatment,
} from "./asset-treatment.js";

export type PixelDensity = 1 | 2 | 4;

export interface VisualImage {
  readonly image: HTMLImageElement;
  readonly pixelDensity: PixelDensity;
}

const ORIGINAL_IMAGE_ROOT = "../assets/original/";
const GENERATED_IMAGE_ROOT = "../assets/generated/";
const ORIGINAL_IMAGE_URLS = Object.freeze({
  ...import.meta.glob<string>("../assets/original/**/*.png", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.jpg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.jpeg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/original/**/*.svg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
});
const GENERATED_IMAGE_URLS = Object.freeze({
  ...import.meta.glob<string>("../assets/generated/*/**/*.png", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/*/**/*.jpg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/*/**/*.jpeg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
  ...import.meta.glob<string>("../assets/generated/*/**/*.svg", {
    eager: true,
    query: "?url&no-inline",
    import: "default",
  }),
});
const GENERATED_MANIFEST_TEXTS = import.meta.glob<string>(
  "../assets/generated/*/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

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

interface AssetSource {
  readonly url: string;
  readonly pixelDensity: PixelDensity;
}

interface GeneratedTreatmentInfo {
  readonly pixelDensities: ReadonlyMap<string, PixelDensity>;
}

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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function pixelDensity(value: unknown, manifestPath: string): PixelDensity {
  if (value === 1 || value === 2 || value === 4) return value;
  throw new Error(`Invalid pixel density in ${manifestPath}`);
}

function parseGeneratedManifest(
  manifestPath: string,
  raw: string,
): GeneratedTreatmentInfo {
  const value: unknown = JSON.parse(raw);
  const outputs = isRecord(value) ? value.outputs : undefined;
  const files = isRecord(outputs) ? outputs.files : undefined;
  if (!Array.isArray(files)) {
    throw new Error(`Invalid generated asset manifest: ${manifestPath}`);
  }
  const densities = new Map<string, PixelDensity>();
  for (const file of files) {
    if (!isRecord(file) || typeof file.path !== "string") {
      throw new Error(`Invalid generated asset record in ${manifestPath}`);
    }
    densities.set(file.path, pixelDensity(file.pixelDensity, manifestPath));
  }
  return Object.freeze({ pixelDensities: densities });
}

function generatedDirectoryAndPath(key: string): readonly [string, string] {
  const relative = key.slice(GENERATED_IMAGE_ROOT.length);
  const separator = relative.indexOf("/");
  if (separator <= 0) throw new Error(`Invalid generated asset path: ${key}`);
  return [relative.slice(0, separator), relative.slice(separator + 1)];
}

const generatedUrlsByTreatment = new Map<string, Map<string, string>>();
for (const [key, url] of Object.entries(GENERATED_IMAGE_URLS)) {
  const [directory, path] = generatedDirectoryAndPath(key);
  const urls =
    generatedUrlsByTreatment.get(directory) ?? new Map<string, string>();
  urls.set(path, url);
  generatedUrlsByTreatment.set(directory, urls);
}
const GENERATED_URLS_BY_TREATMENT: ReadonlyMap<
  string,
  ReadonlyMap<string, string>
> = generatedUrlsByTreatment;

const GENERATED_INFO_BY_TREATMENT = new Map<string, GeneratedTreatmentInfo>();
for (const [key, raw] of Object.entries(GENERATED_MANIFEST_TEXTS)) {
  const relative = key.slice(GENERATED_IMAGE_ROOT.length);
  const separator = relative.indexOf("/");
  if (separator <= 0 || !relative.endsWith("/manifest.json")) {
    throw new Error(`Invalid generated manifest path: ${key}`);
  }
  const directory = relative.slice(0, separator);
  GENERATED_INFO_BY_TREATMENT.set(directory, parseGeneratedManifest(key, raw));
}

function originalImageUrl(path: string): string {
  const url = ORIGINAL_IMAGE_URLS[`${ORIGINAL_IMAGE_ROOT}${path}`];
  if (url === undefined) throw new Error(`Missing original image: ${path}`);
  return url;
}

function selectedImageSource(
  path: string,
  treatment: AssetTreatment,
): AssetSource {
  const directory = treatment.directory;
  if (directory === undefined) {
    return Object.freeze({ url: originalImageUrl(path), pixelDensity: 1 });
  }
  const generatedUrls = GENERATED_URLS_BY_TREATMENT.get(directory);
  const generatedUrl = generatedUrls?.get(path);
  if (generatedUrl === undefined) {
    return Object.freeze({ url: originalImageUrl(path), pixelDensity: 1 });
  }
  const generatedInfo = GENERATED_INFO_BY_TREATMENT.get(directory);
  return Object.freeze({
    url: generatedUrl,
    pixelDensity: generatedInfo?.pixelDensities.get(path) ?? 1,
  });
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
export function createVisualStyleUrls(
  treatment: AssetTreatment,
): VisualStyleUrls {
  const cursor = selectedImageSource("images/12.png", treatment);
  return Object.freeze({
    parchment: selectedImageSource("images/529.jpg", treatment).url,
    titleHero: selectedImageSource("images/533.png", treatment).url,
    sky: selectedImageSource("images/357.jpg", treatment).url,
    skyMask: selectedImageSource("shapes/350.svg", treatment).url,
    logo: selectedImageSource("images/268.png", treatment).url,
    // CSS cursors have no portable logical-size declaration. A high-density
    // cursor would therefore render at four times the intended size.
    cursor:
      cursor.pixelDensity === 1
        ? cursor.url
        : originalImageUrl("images/12.png"),
  });
}

function sourceRecord<Key extends string>(
  paths: Readonly<Record<Key, string>>,
  treatment: AssetTreatment,
): Readonly<Record<Key, AssetSource>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(paths).map((id) => [
        id,
        selectedImageSource(paths[id as Key], treatment),
      ]),
    ),
  ) as Readonly<Record<Key, AssetSource>>;
}

function numberedAssetPaths(prefix: string): readonly string[] {
  return Object.keys(ORIGINAL_IMAGE_URLS)
    .map((key) => key.slice(ORIGINAL_IMAGE_ROOT.length))
    .filter((path) => path.startsWith(prefix))
    .sort(
      (left, right) =>
        Number(left.split("/").at(-1)?.split(".")[0]) -
        Number(right.split("/").at(-1)?.split(".")[0]),
    );
}

function numberedAssetSources(
  prefix: string,
  treatment: AssetTreatment,
): readonly AssetSource[] {
  return Object.freeze(
    numberedAssetPaths(prefix).map((path) =>
      selectedImageSource(path, treatment),
    ),
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

function createVisualAssetSources(
  treatment: AssetTreatment,
): VisualAssetSources {
  const actionEffectFrames = {
    buy: numberedAssetSources(ACTION_EFFECT_PREFIXES.buy, treatment),
    item: numberedAssetSources(ACTION_EFFECT_PREFIXES.item, treatment),
    upgrade: numberedAssetSources(ACTION_EFFECT_PREFIXES.upgrade, treatment),
  };
  const animationFrames = {
    hero: numberedAssetSources(ACTOR_PREFIXES.hero, treatment),
    dragon: numberedAssetSources(ACTOR_PREFIXES.dragon, treatment),
    goblin: numberedAssetSources(ACTOR_PREFIXES.goblin, treatment),
    golem: numberedAssetSources(ACTOR_PREFIXES.golem, treatment),
    wolf: numberedAssetSources(ACTOR_PREFIXES.wolf, treatment),
  };
  return Object.freeze({
    sprites: sourceRecord(SPRITE_PATHS, treatment),
    scenes: sourceRecord(SCENE_PATHS, treatment),
    effects: sourceRecord(EFFECT_PATHS, treatment),
    ui: sourceRecord(UI_PATHS, treatment),
    clickEffectFrames: numberedAssetSources(
      "effects/DefineSprite_311_MouseEffect/",
      treatment,
    ),
    actionEffectFrames,
    flashEffectFrames: numberedAssetSources(
      "effects/DefineSprite_369_Effect-Flash/",
      treatment,
    ),
    animationFrames,
  });
}

const ORIGINAL_ASSET_SOURCES = createVisualAssetSources(
  ORIGINAL_ASSET_TREATMENT,
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
  readonly treatment: AssetTreatment;
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
  treatment: AssetTreatment = ORIGINAL_ASSET_TREATMENT,
): VisualAtlas {
  const sources = createVisualAssetSources(treatment);
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
      const image = new Image();
      image.decoding = "async";
      const settle = (): void => {
        pending -= 1;
        if (pending !== 0) return;
        coreSettled = true;
        status =
          loaded === 0 ? "unavailable" : failed > 0 ? "partial" : "ready";
        onStatusChange(status);
      };
      image.onload = () => {
        save(Object.freeze({ image, pixelDensity: source.pixelDensity }));
        loaded += 1;
        settle();
      };
      image.onerror = () => {
        failed += 1;
        settle();
      };
      image.src = source.url;
    };
    const loadOptional = (
      source: AssetSource,
      save: (image: VisualImage) => void,
    ): void => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        save(Object.freeze({ image, pixelDensity: source.pixelDensity }));
        if (coreSettled && status === "ready") onStatusChange(status);
      };
      image.onerror = () => undefined;
      image.src = source.url;
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
    treatment,
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
