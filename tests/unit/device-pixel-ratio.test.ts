import { describe, expect, it, vi } from "vitest";

import { observeDevicePixelRatioChanges } from "../../src/device-pixel-ratio.js";

describe("observeDevicePixelRatioChanges", () => {
  it("redraws and observes the new resolution after a DPR change", () => {
    const listeners: Array<() => void> = [];
    const environment = {
      devicePixelRatio: 1,
      matchMedia: vi.fn((query: string) => ({
        addEventListener: (
          type: "change",
          listener: () => void,
          options: { readonly once: true },
        ) => {
          expect(type).toBe("change");
          expect(options).toEqual({ once: true });
          listeners.push(listener);
        },
        query,
      })),
    };
    const redraw = vi.fn();

    observeDevicePixelRatioChanges(environment, redraw);
    expect(environment.matchMedia).toHaveBeenLastCalledWith(
      "(resolution: 1dppx)",
    );

    environment.devicePixelRatio = 2;
    listeners[0]?.();

    expect(redraw).toHaveBeenCalledOnce();
    expect(environment.matchMedia).toHaveBeenLastCalledWith(
      "(resolution: 2dppx)",
    );
  });
});
