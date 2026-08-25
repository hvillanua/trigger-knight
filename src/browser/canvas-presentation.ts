import type {
  GameEvent,
  PresentationFrame,
  PresentationPort,
} from "../application/contracts.js";
import { calculateBackingStoreSize, type CssDimensions } from "./foundation.js";

function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case "pause-toggled":
      return `${event.type}:${String(event.paused)}`;
    case "step-advanced":
      return `${event.type}:${event.step}`;
    case "tutorial-dismissed":
      return `${event.type}:${event.page}`;
  }
}

/** Canvas 2D adapter for public gameplay observations and events. */
export class CanvasPresentation implements PresentationPort {
  readonly #canvas: HTMLCanvasElement;
  #frame: PresentationFrame | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#canvas.dataset.renderer = "canvas-2d";
  }

  present(frame: PresentationFrame): void {
    this.#frame = frame;
    this.#canvas.dataset.observationStep = String(frame.current.steps);
    this.#canvas.dataset.events = frame.events.map(describeEvent).join(",");
    this.#draw();
  }

  resize(cssDimensions: CssDimensions, devicePixelRatio: number): void {
    const backingStore = calculateBackingStoreSize(
      cssDimensions,
      devicePixelRatio,
    );
    this.#canvas.width = backingStore.width;
    this.#canvas.height = backingStore.height;
    this.#draw();
  }

  #draw(): void {
    const context = this.#canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D is unavailable");
    }

    const gradient = context.createLinearGradient(0, 0, 0, this.#canvas.height);
    gradient.addColorStop(0, "#18213b");
    gradient.addColorStop(1, "#080b14");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

    const titleSize = Math.max(18, Math.round(this.#canvas.height / 13));
    context.fillStyle = "#f4d58d";
    context.font = `600 ${titleSize}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      "Trigger Knight",
      this.#canvas.width / 2,
      this.#canvas.height / 2 - titleSize / 2,
    );

    if (this.#frame === undefined) {
      return;
    }

    context.fillStyle = "#bac6df";
    context.font = `500 ${Math.max(12, Math.round(titleSize / 2))}px system-ui`;
    context.fillText(
      `Step ${this.#frame.current.steps}`,
      this.#canvas.width / 2,
      this.#canvas.height / 2 + titleSize,
    );

    const eventDescription = this.#frame.events.map(describeEvent).join(", ");
    if (eventDescription !== "") {
      context.fillText(
        eventDescription,
        this.#canvas.width / 2,
        this.#canvas.height / 2 + titleSize * 1.75,
      );
    }
  }
}
