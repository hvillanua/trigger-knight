import type { ActorSpriteId } from "./sprite-animation.js";

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

/** Reviewed frames exported from the original FXHit timeline. */
export const ORIGINAL_EFFECT_IMAGE_URLS: Readonly<
  Record<OriginalEffectImageId, string>
> = Object.freeze({
  "hit-1": new URL("../assets/original/images/119.png", import.meta.url).href,
  "hit-2": new URL("../assets/original/images/121.png", import.meta.url).href,
  "hit-3": new URL("../assets/original/images/123.png", import.meta.url).href,
  "hit-4": new URL("../assets/original/images/125.png", import.meta.url).href,
  "hit-5": new URL("../assets/original/images/127.png", import.meta.url).href,
  "hit-6": new URL("../assets/original/images/129.png", import.meta.url).href,
  "hit-7": new URL("../assets/original/images/131.png", import.meta.url).href,
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
  "session-over-pointer": new URL(
    "../assets/original/images/12.png",
    import.meta.url,
  ).href,
  "weapon-upgrade-icon": new URL(
    "../assets/original/images/156.png",
    import.meta.url,
  ).href,
  "armor-upgrade-icon": new URL(
    "../assets/original/images/158.png",
    import.meta.url,
  ).href,
  "shrine-icon": new URL("../assets/original/images/172.png", import.meta.url)
    .href,
  "elixir-icon": new URL("../assets/original/images/160.png", import.meta.url)
    .href,
  "divine-edge-icon": new URL(
    "../assets/original/images/162.png",
    import.meta.url,
  ).href,
  "voucher-icon": new URL("../assets/original/images/164.png", import.meta.url)
    .href,
  "weapon-event-icon": new URL(
    "../assets/original/images/168.png",
    import.meta.url,
  ).href,
  "armor-event-icon": new URL(
    "../assets/original/images/170.png",
    import.meta.url,
  ).href,
  "monster-icon": new URL("../assets/original/images/179.png", import.meta.url)
    .href,
  "weapon-stats-icon": new URL(
    "../assets/original/images/197.png",
    import.meta.url,
  ).href,
  "item-stats-icon": new URL(
    "../assets/original/images/198.png",
    import.meta.url,
  ).href,
  "armor-stats-icon": new URL(
    "../assets/original/images/199.png",
    import.meta.url,
  ).href,
});

const frameUrls = import.meta.glob<string>(
  "../assets/original/key-sprites/*/*.png",
  { eager: true, query: "?url&no-inline", import: "default" },
);

const clickEffectFrameUrls = import.meta.glob<string>(
  "../assets/original/effects/DefineSprite_311_MouseEffect/*.png",
  { eager: true, query: "?url&no-inline", import: "default" },
);

const actionEffectFrameUrls: Readonly<
  Record<OriginalActionEffectId, Record<string, string>>
> = {
  buy: import.meta.glob<string>(
    "../assets/original/effects/DefineSprite_118_FXBuy/*.png",
    { eager: true, query: "?url&no-inline", import: "default" },
  ),
  item: import.meta.glob<string>(
    "../assets/original/effects/DefineSprite_151_FXItem/*.png",
    { eager: true, query: "?url&no-inline", import: "default" },
  ),
  upgrade: import.meta.glob<string>(
    "../assets/original/effects/DefineSprite_153_FXUpgrade/*.png",
    { eager: true, query: "?url&no-inline", import: "default" },
  ),
};

const flashEffectFrameUrls = import.meta.glob<string>(
  "../assets/original/effects/DefineSprite_369_Effect-Flash/*.png",
  { eager: true, query: "?url&no-inline", import: "default" },
);

function numberedAssetUrls(
  entries: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.freeze(
    Object.entries(entries)
      .sort(
        ([a], [b]) =>
          Number(a.split("/").at(-1)?.split(".")[0]) -
          Number(b.split("/").at(-1)?.split(".")[0]),
      )
      .map(([, url]) => url),
  );
}

/** Reviewed frames exported from the original MouseEffect click-feedback timeline. */
export const ORIGINAL_CLICK_EFFECT_URLS: readonly string[] = Object.freeze(
  numberedAssetUrls(clickEffectFrameUrls),
);

/** Reviewed frames exported from the original purchase and item action timelines. */
export const ORIGINAL_ACTION_EFFECT_URLS: Readonly<
  Record<OriginalActionEffectId, readonly string[]>
> = Object.freeze({
  buy: numberedAssetUrls(actionEffectFrameUrls.buy),
  item: numberedAssetUrls(actionEffectFrameUrls.item),
  upgrade: numberedAssetUrls(actionEffectFrameUrls.upgrade),
});

/** Reviewed frames exported from the original lifespan-restoration flash timeline. */
export const ORIGINAL_FLASH_EFFECT_URLS: readonly string[] = Object.freeze(
  numberedAssetUrls(flashEffectFrameUrls),
);

function entityFrames(entity: string): readonly string[] {
  return numberedAssetUrls(
    Object.fromEntries(
      Object.entries(frameUrls).filter(([path]) =>
        path.includes(`/${entity}/`),
      ),
    ),
  );
}

export const ORIGINAL_ANIMATION_URLS: Readonly<
  Record<ActorSpriteId, readonly string[]>
> = Object.freeze({
  hero: entityFrames("DefineSprite_497_Hero"),
  dragon: entityFrames("DefineSprite_397_EnemyDragon"),
  goblin: entityFrames("DefineSprite_421_EnemyGoblin"),
  golem: entityFrames("DefineSprite_446_EnemyGolem"),
  wolf: entityFrames("DefineSprite_477_EnemyWolf"),
});

export type VisualAtlasStatus = "loading" | "ready" | "partial" | "unavailable";

export interface VisualAtlas {
  readonly status: VisualAtlasStatus;
  readonly originalImages: Readonly<
    Partial<Record<VisualSpriteId, HTMLImageElement>>
  >;
  readonly originalFrames: Readonly<
    Partial<Record<ActorSpriteId, readonly (HTMLImageElement | undefined)[]>>
  >;
  readonly sceneImages: Readonly<
    Partial<Record<OriginalSceneAssetId, HTMLImageElement>>
  >;
  readonly effectImages: Readonly<
    Partial<Record<OriginalEffectImageId, HTMLImageElement>>
  >;
  readonly clickEffectFrames: Readonly<(HTMLImageElement | undefined)[]>;
  readonly actionEffectFrames: Readonly<
    Record<OriginalActionEffectId, readonly (HTMLImageElement | undefined)[]>
  >;
  readonly flashEffectFrames: Readonly<(HTMLImageElement | undefined)[]>;
  readonly uiImages: Readonly<
    Partial<Record<OriginalUiImageId, HTMLImageElement>>
  >;
}

/** Failed or unmapped artwork stays absent. Gameplay never waits for images. */
export function createVisualAtlas(
  onStatusChange: (status: VisualAtlasStatus) => void,
): VisualAtlas {
  let status: VisualAtlasStatus =
    typeof Image === "undefined" ? "unavailable" : "loading";
  const originalImages: Partial<Record<VisualSpriteId, HTMLImageElement>> = {};
  const originalFrames: Partial<
    Record<ActorSpriteId, (HTMLImageElement | undefined)[]>
  > = {};
  const sceneImages: Partial<Record<OriginalSceneAssetId, HTMLImageElement>> =
    {};
  const effectImages: Partial<Record<OriginalEffectImageId, HTMLImageElement>> =
    {};
  const clickEffectFrames: (HTMLImageElement | undefined)[] = Array.from(
    { length: ORIGINAL_CLICK_EFFECT_URLS.length },
    () => undefined,
  );
  const actionEffectFrames: Record<
    OriginalActionEffectId,
    (HTMLImageElement | undefined)[]
  > = {
    buy: Array.from(
      { length: ORIGINAL_ACTION_EFFECT_URLS.buy.length },
      () => undefined,
    ),
    item: Array.from(
      { length: ORIGINAL_ACTION_EFFECT_URLS.item.length },
      () => undefined,
    ),
    upgrade: Array.from(
      { length: ORIGINAL_ACTION_EFFECT_URLS.upgrade.length },
      () => undefined,
    ),
  };
  const flashEffectFrames: (HTMLImageElement | undefined)[] = Array.from(
    { length: ORIGINAL_FLASH_EFFECT_URLS.length },
    () => undefined,
  );
  const uiImages: Partial<Record<OriginalUiImageId, HTMLImageElement>> = {};
  if (status === "loading") {
    let pending =
      Object.values(ORIGINAL_ANIMATION_URLS).reduce(
        (total, urls) => total + urls.length,
        0,
      ) +
      Object.keys(ORIGINAL_SCENE_ASSET_URLS).length +
      Object.keys(ORIGINAL_EFFECT_IMAGE_URLS).length +
      ORIGINAL_CLICK_EFFECT_URLS.length +
      Object.keys(ORIGINAL_UI_IMAGE_URLS).length +
      Object.keys(ORIGINAL_ACTION_EFFECT_URLS).length +
      (ORIGINAL_FLASH_EFFECT_URLS.length > 0 ? 1 : 0);
    let loaded = 0;
    let failed = 0;
    let coreSettled = false;
    const load = (
      url: string,
      save: (image: HTMLImageElement) => void,
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
        save(image);
        loaded += 1;
        settle();
      };
      image.onerror = () => {
        failed += 1;
        settle();
      };
      image.src = url;
    };
    const loadOptional = (
      url: string,
      save: (image: HTMLImageElement) => void,
    ): void => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        save(image);
        if (coreSettled && status === "ready") onStatusChange(status);
      };
      image.onerror = () => undefined;
      image.src = url;
    };
    for (const id of Object.keys(ORIGINAL_ANIMATION_URLS) as ActorSpriteId[]) {
      const urls = ORIGINAL_ANIMATION_URLS[id];
      const frames: (HTMLImageElement | undefined)[] = Array.from(
        { length: urls.length },
        () => undefined,
      );
      originalFrames[id] = frames;
      urls.forEach((url, index) =>
        load(url, (image) => {
          frames[index] = image;
          if (index === 0) originalImages[id] = image;
        }),
      );
    }
    for (const id of Object.keys(
      ORIGINAL_SCENE_ASSET_URLS,
    ) as OriginalSceneAssetId[]) {
      load(ORIGINAL_SCENE_ASSET_URLS[id], (image) => {
        sceneImages[id] = image;
      });
    }
    for (const id of Object.keys(
      ORIGINAL_EFFECT_IMAGE_URLS,
    ) as OriginalEffectImageId[]) {
      load(ORIGINAL_EFFECT_IMAGE_URLS[id], (image) => {
        effectImages[id] = image;
      });
    }
    ORIGINAL_CLICK_EFFECT_URLS.forEach((url, index) =>
      load(url, (image) => {
        clickEffectFrames[index] = image;
      }),
    );
    for (const id of Object.keys(
      ORIGINAL_UI_IMAGE_URLS,
    ) as OriginalUiImageId[]) {
      load(ORIGINAL_UI_IMAGE_URLS[id], (image) => {
        uiImages[id] = image;
      });
    }
    for (const id of Object.keys(
      ORIGINAL_ACTION_EFFECT_URLS,
    ) as OriginalActionEffectId[]) {
      const urls = ORIGINAL_ACTION_EFFECT_URLS[id];
      const firstUrl = urls[0];
      if (firstUrl !== undefined) {
        load(firstUrl, (image) => {
          actionEffectFrames[id][0] = image;
        });
      }
      urls.slice(1).forEach((url, index) =>
        loadOptional(url, (image) => {
          actionEffectFrames[id][index + 1] = image;
        }),
      );
    }
    const firstFlashUrl = ORIGINAL_FLASH_EFFECT_URLS[0];
    if (firstFlashUrl !== undefined) {
      load(firstFlashUrl, (image) => {
        flashEffectFrames[0] = image;
      });
    }
    ORIGINAL_FLASH_EFFECT_URLS.slice(1).forEach((url, index) =>
      loadOptional(url, (image) => {
        flashEffectFrames[index + 1] = image;
      }),
    );
  }
  return Object.freeze({
    get status() {
      return status;
    },
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
