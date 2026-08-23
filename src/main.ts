import { drawFoundation } from "./foundation.js";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");

if (canvas === null) {
  throw new Error("Missing #game-canvas");
}

const render = (): void => {
  drawFoundation(canvas, window.devicePixelRatio);
};

render();

const resizeObserver = new ResizeObserver(render);
resizeObserver.observe(canvas);
