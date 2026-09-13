export type FullscreenState = "unsupported" | "available" | "active" | "denied";

export interface FullscreenStateChange {
  readonly state: FullscreenState;
  readonly supported: boolean;
  readonly active: boolean;
}

export interface FullscreenControllerOptions {
  readonly document?: Document;
  readonly onStateChange?: (change: FullscreenStateChange) => void;
}

export interface FullscreenController {
  sync(): void;
  toggle(): Promise<void>;
  exit(): Promise<void>;
  dispose(): void;
}

function isSupported(document: Document, target: HTMLElement): boolean {
  return (
    Boolean(document.fullscreenEnabled) &&
    typeof document.exitFullscreen === "function" &&
    typeof target.requestFullscreen === "function"
  );
}

/** Keeps optional browser fullscreen state outside the authoritative game. */
export function createFullscreenController(
  target: HTMLElement,
  options: FullscreenControllerOptions = {},
): FullscreenController {
  const documentReference = options.document ?? document;
  const onStateChange = options.onStateChange ?? (() => undefined);

  const publish = (stateOverride?: FullscreenState): void => {
    const supported = isSupported(documentReference, target);
    const active = documentReference.fullscreenElement === target;
    const state: FullscreenState =
      stateOverride === "denied"
        ? "denied"
        : !supported
          ? "unsupported"
          : active
            ? "active"
            : "available";
    onStateChange({ state, supported, active });
  };

  const onFullscreenChange = (): void => publish();
  const onFullscreenError = (): void => publish("denied");
  documentReference.addEventListener("fullscreenchange", onFullscreenChange);
  documentReference.addEventListener("fullscreenerror", onFullscreenError);
  publish();

  return Object.freeze({
    sync(): void {
      publish();
    },
    async toggle(): Promise<void> {
      if (!isSupported(documentReference, target)) {
        publish();
        return;
      }

      try {
        if (documentReference.fullscreenElement === target) {
          await documentReference.exitFullscreen();
        } else {
          await target.requestFullscreen();
        }
        publish();
      } catch {
        publish("denied");
      }
    },
    async exit(): Promise<void> {
      if (
        !isSupported(documentReference, target) ||
        documentReference.fullscreenElement !== target
      ) {
        publish();
        return;
      }

      try {
        await documentReference.exitFullscreen();
        publish();
      } catch {
        publish("denied");
      }
    },
    dispose(): void {
      documentReference.removeEventListener(
        "fullscreenchange",
        onFullscreenChange,
      );
      documentReference.removeEventListener(
        "fullscreenerror",
        onFullscreenError,
      );
    },
  });
}
