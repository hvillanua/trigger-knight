import type { WorldCamera } from "../domain/contracts.js";

export interface CssDimensions {
  readonly width: number;
  readonly height: number;
}

export interface BackingStoreSize {
  readonly width: number;
  readonly height: number;
}

export interface WorldProjection {
  readonly scale: number;
  readonly viewport: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>;
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

export function calculateWorldProjection(
  camera: Readonly<WorldCamera>,
  output: Readonly<BackingStoreSize>,
): WorldProjection {
  if (
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.width) ||
    camera.width <= 0 ||
    !Number.isFinite(camera.height) ||
    camera.height <= 0
  ) {
    throw new RangeError("World camera must have finite positive dimensions");
  }

  const outputWidth = Math.max(1, usableDimension(output.width));
  const outputHeight = Math.max(1, usableDimension(output.height));
  const scale = Math.min(
    outputWidth / camera.width,
    outputHeight / camera.height,
  );
  const width = camera.width * scale;
  const height = camera.height * scale;

  return Object.freeze({
    scale,
    viewport: Object.freeze({
      x: (outputWidth - width) / 2,
      y: (outputHeight - height) / 2,
      width,
      height,
    }),
  });
}
