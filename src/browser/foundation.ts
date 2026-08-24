/** Physical sizing values used by Canvas presentation adapters. */
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
