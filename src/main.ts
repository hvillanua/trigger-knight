import { drawFoundation } from "./foundation.js";
import { observeDevicePixelRatioChanges } from "./device-pixel-ratio.js";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (canvas === null) {
  throw new Error("Missing #game-canvas");
}

const render = (): void => {
  drawFoundation(canvas, window.devicePixelRatio);
};

render();
observeDevicePixelRatioChanges(window, render);
window.addEventListener("resize", render);

const resizeObserver = new ResizeObserver(render);
resizeObserver.observe(canvas);
