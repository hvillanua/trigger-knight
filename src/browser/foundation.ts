import type { WorldCamera } from "../domain/contracts.js";

/** Physical sizing values used by Canvas presentation adapters. */
export interface CssDimensions {
  readonly width: number;
  readonly height: number;
}

export interface BackingStoreSize {
  readonly width: number;
  readonly height: number;
}

/** Letterboxed backing-store rectangle for one ruleset-space camera. */
export interface WorldProjection {
  readonly scale: number;
  readonly viewport: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>;
}

export interface CanvasClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasBorders {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
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

/** Fits the complete world camera into physical output without cropping it. */
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

/**
 * Converts a client-space pointer into ruleset-space coordinates.
 * Letterbox and border clicks return null so they cannot activate a target.
 */
export function mapClientPointToWorld(
  camera: Readonly<WorldCamera>,
  output: Readonly<BackingStoreSize>,
  cssDimensions: Readonly<CssDimensions>,
  clientRect: Readonly<CanvasClientRect>,
  clientPoint: Readonly<ClientPoint>,
  borders: Readonly<CanvasBorders> = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
): WorldPoint | null {
  const cssWidth = usableDimension(cssDimensions.width);
  const cssHeight = usableDimension(cssDimensions.height);
  if (cssWidth <= 0 || cssHeight <= 0) return null;
  if (
    !Number.isFinite(clientRect.left) ||
    !Number.isFinite(clientRect.top) ||
    !Number.isFinite(clientRect.width) ||
    !Number.isFinite(clientRect.height) ||
    clientRect.width <= 0 ||
    clientRect.height <= 0 ||
    !Number.isFinite(clientPoint.x) ||
    !Number.isFinite(clientPoint.y)
  ) {
    return null;
  }

  const contentX = clientPoint.x - clientRect.left - borders.left;
  const contentY = clientPoint.y - clientRect.top - borders.top;
  if (
    !Number.isFinite(contentX) ||
    !Number.isFinite(contentY) ||
    contentX < 0 ||
    contentY < 0 ||
    contentX > cssWidth ||
    contentY > cssHeight
  ) {
    return null;
  }

  const backingWidth = Math.max(1, usableDimension(output.width));
  const backingHeight = Math.max(1, usableDimension(output.height));
  const backingPoint = {
    x: (contentX / cssWidth) * backingWidth,
    y: (contentY / cssHeight) * backingHeight,
  };
  const projection = calculateWorldProjection(camera, {
    width: backingWidth,
    height: backingHeight,
  });
  const { viewport } = projection;
  if (
    backingPoint.x < viewport.x ||
    backingPoint.x > viewport.x + viewport.width ||
    backingPoint.y < viewport.y ||
    backingPoint.y > viewport.y + viewport.height
  ) {
    return null;
  }

  return Object.freeze({
    x: camera.x + (backingPoint.x - viewport.x) / projection.scale,
    y: camera.y + (backingPoint.y - viewport.y) / projection.scale,
  });
}
