import { describe, expect, it, vi } from "vitest";

import {
  createFullscreenController,
  type FullscreenStateChange,
} from "../../src/browser/fullscreen.js";

interface FakeFullscreenDocument {
  readonly document: Document;
  readonly target: HTMLElement;
  readonly requestFullscreen: ReturnType<typeof vi.fn>;
  readonly exitFullscreen: ReturnType<typeof vi.fn>;
  setSupported(supported: boolean): void;
}

function createFakeDocument(
  request: () => Promise<void> = () => Promise.resolve(),
): FakeFullscreenDocument {
  let supported = true;
  let fullscreenElement: Element | null = null;
  const listeners = new Map<string, Set<EventListener>>();
  const dispatch = (type: string): void => {
    for (const listener of listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  };
  const requestFullscreen = vi.fn(async () => {
    await request();
    fullscreenElement = target;
    dispatch("fullscreenchange");
  });
  const target = { requestFullscreen } as unknown as HTMLElement;
  const exitFullscreen = vi.fn(() => {
    fullscreenElement = null;
    dispatch("fullscreenchange");
    return Promise.resolve();
  });
  const document = {
    get fullscreenEnabled() {
      return supported;
    },
    get fullscreenElement() {
      return fullscreenElement;
    },
    exitFullscreen,
    addEventListener: (type: string, listener: EventListener) => {
      const entries = listeners.get(type) ?? new Set<EventListener>();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    },
  } as unknown as Document;

  return {
    document,
    target,
    requestFullscreen,
    exitFullscreen,
    setSupported(nextSupported) {
      supported = nextSupported;
    },
  };
}

describe("fullscreen controller", () => {
  it("tracks entry, exit, and fullscreen change events", async () => {
    const fake = createFakeDocument();
    const changes: FullscreenStateChange[] = [];
    const controller = createFullscreenController(fake.target, {
      document: fake.document,
      onStateChange: (change) => changes.push(change),
    });

    expect(changes.at(-1)).toEqual({
      state: "available",
      supported: true,
      active: false,
    });
    await controller.toggle();
    expect(fake.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(changes.at(-1)).toEqual({
      state: "active",
      supported: true,
      active: true,
    });
    await controller.toggle();
    expect(fake.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(changes.at(-1)).toEqual({
      state: "available",
      supported: true,
      active: false,
    });

    controller.dispose();
  });

  it("reports denied requests and lets a later sync recover", async () => {
    const fake = createFakeDocument(() =>
      Promise.reject(new Error("permission denied")),
    );
    const changes: FullscreenStateChange[] = [];
    const controller = createFullscreenController(fake.target, {
      document: fake.document,
      onStateChange: (change) => changes.push(change),
    });

    await controller.toggle();
    expect(changes.at(-1)?.state).toBe("denied");
    controller.sync();
    expect(changes.at(-1)?.state).toBe("available");
  });

  it("reports unsupported hosts without calling browser APIs", async () => {
    const fake = createFakeDocument();
    fake.setSupported(false);
    const changes: FullscreenStateChange[] = [];
    const controller = createFullscreenController(fake.target, {
      document: fake.document,
      onStateChange: (change) => changes.push(change),
    });

    expect(changes.at(-1)?.state).toBe("unsupported");
    await controller.toggle();
    expect(fake.requestFullscreen).not.toHaveBeenCalled();
  });
});
