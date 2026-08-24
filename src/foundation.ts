export interface CssDimensions {
  readonly width: number;
  readonly height: number;
}

export interface BackingStoreSize {
  readonly width: number;
  readonly height: number;
}

function usableDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateBackingStoreSize(
  cssDimensions: CssDimensions,
  devicePixelRatio: number,
): BackingStoreSize {
  const scale =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;

  return {
    width: Math.max(
      1,
      Math.round(usableDimension(cssDimensions.width) * scale),
    ),
    height: Math.max(
      1,
      Math.round(usableDimension(cssDimensions.height) * scale),
    ),
  };
}

export function drawFoundation(
  canvas: HTMLCanvasElement,
  cssDimensions: CssDimensions,
  devicePixelRatio: number,
): void {
  const backingStore = calculateBackingStoreSize(
    cssDimensions,
    devicePixelRatio,
  );

  canvas.width = backingStore.width;
  canvas.height = backingStore.height;
  canvas.dataset.renderer = "canvas-2d";

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D is unavailable");
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#18213b");
  gradient.addColorStop(1, "#080b14");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#f4d58d";
  context.font = `600 ${Math.max(18, Math.round(canvas.height / 13))}px system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Trigger Knight", canvas.width / 2, canvas.height / 2);
}
