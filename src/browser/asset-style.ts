import { createVisualStyleUrls } from "./visual-atlas.js";
import type { VisualAssetPack } from "./visual-assets.js";

const STYLE_VARIABLES = Object.freeze({
  parchment: "--trigger-knight-parchment-image",
  titleHero: "--trigger-knight-title-hero-image",
  sky: "--trigger-knight-sky-image",
  skyMask: "--trigger-knight-sky-mask-image",
  logo: "--trigger-knight-logo-image",
  handCursor: "--trigger-knight-hand-cursor",
});

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

/** Applies the selected image treatment to the CSS-owned presentation art. */
export function applyVisualStyleTreatment(
  pack: VisualAssetPack,
  root: HTMLElement = document.documentElement,
): void {
  const urls = createVisualStyleUrls(pack);
  root.style.setProperty(STYLE_VARIABLES.parchment, cssUrl(urls.parchment));
  root.style.setProperty(STYLE_VARIABLES.titleHero, cssUrl(urls.titleHero));
  root.style.setProperty(STYLE_VARIABLES.sky, cssUrl(urls.sky));
  root.style.setProperty(STYLE_VARIABLES.skyMask, cssUrl(urls.skyMask));
  root.style.setProperty(STYLE_VARIABLES.logo, cssUrl(urls.logo));
  root.style.setProperty(
    STYLE_VARIABLES.handCursor,
    `${cssUrl(urls.cursor)} 4 2, pointer`,
  );
}
