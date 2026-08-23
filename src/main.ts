import { drawFoundation, type CssDimensions } from "./foundation.js";
import { observeDevicePixelRatioChanges } from "./device-pixel-ratio.js";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (canvas === null) {
  throw new Error("Missing #game-canvas");
}

let contentBox: CssDimensions | undefined;

const render = (): void => {
  if (contentBox === undefined) {
    return;
  }

  drawFoundation(canvas, contentBox, window.devicePixelRatio);
};

observeDevicePixelRatioChanges(window, render);
window.addEventListener("resize", render);

const resizeObserver = new ResizeObserver(([entry]) => {
  if (entry === undefined) {
    return;
  }

  contentBox = {
    width: entry.contentRect.width,
    height: entry.contentRect.height,
  };
  render();
});
resizeObserver.observe(canvas);
