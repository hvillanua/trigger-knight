import type {
  GameEvent,
  SoundCue,
  SoundInitializationResult,
  SoundPort,
  SoundStatus,
  SoundUiAction,
} from "../application/contracts.js";
import type { SoundPreferences } from "../application/settings.js";

const MAX_RETAINED_CUES = 256;

export const SOUND_CUES: readonly SoundCue[] = Object.freeze([
  "ui-activate",
  "ui-confirm",
  "ui-cancel",
  "encounter",
  "shop-purchase",
  "purchase-rejected",
  "item-use",
  "item-use-rejected",
  "battle-start",
  "combat-attack",
  "combat-hit",
  "combat-lethal",
  "reward",
  "discovery",
  "achievement",
  "death",
  "run-ended",
  "pause",
]);

const assetUrl = (fileName: string): string =>
  new URL(`../assets/sound-effects/${fileName}`, import.meta.url).href;

/** Independently authored runtime assets. Original SWF audio is never imported. */
export const SOUND_CUE_ASSET_URLS: Readonly<Record<SoundCue, string>> =
  Object.freeze({
    "ui-activate": assetUrl("ui-activate.wav"),
    "ui-confirm": assetUrl("ui-confirm.wav"),
    "ui-cancel": assetUrl("ui-cancel.wav"),
    encounter: assetUrl("encounter.wav"),
    "shop-purchase": assetUrl("purchase.wav"),
    "purchase-rejected": assetUrl("reject.wav"),
    "item-use": assetUrl("item.wav"),
    "item-use-rejected": assetUrl("reject.wav"),
    "battle-start": assetUrl("battle-start.wav"),
    "combat-attack": assetUrl("attack.wav"),
    "combat-hit": assetUrl("hit.wav"),
    "combat-lethal": assetUrl("lethal.wav"),
    reward: assetUrl("reward.wav"),
    discovery: assetUrl("reward.wav"),
    achievement: assetUrl("achievement.wav"),
    death: assetUrl("death.wav"),
    "run-ended": assetUrl("death.wav"),
    pause: assetUrl("ui-confirm.wav"),
  });

const cueList = (...cues: SoundCue[]): readonly SoundCue[] =>
  Object.freeze(cues);

/** Static event mappings remain inspectable without coupling the domain to audio. */
export const SOUND_EVENT_CUES: Readonly<
  Record<GameEvent["type"], readonly SoundCue[]>
> = Object.freeze({
  "achievement-unlocked": cueList("achievement"),
  "battle-started": cueList("battle-start"),
  "battle-reward": cueList("reward"),
  "combat-phase-changed": cueList(),
  "combat-hit": cueList("combat-hit"),
  "combat-lethal-hit": cueList("combat-lethal"),
  "equipment-discovered": cueList("discovery"),
  "encounter-promoted": cueList("encounter"),
  "item-use-rejected": cueList("item-use-rejected"),
  "item-used": cueList("item-use"),
  "lifespan-death": cueList("death"),
  "pause-toggled": cueList("pause"),
  "purchase-rejected": cueList("purchase-rejected"),
  "run-ended": cueList("run-ended"),
  "shop-purchased": cueList("shop-purchase"),
  "shop-departed": cueList("encounter"),
  "step-advanced": cueList(),
  "tutorial-dismissed": cueList("ui-confirm"),
});

export const SOUND_UI_ACTION_CUES: Readonly<
  Record<SoundUiAction, readonly SoundCue[]>
> = Object.freeze({
  activate: cueList("ui-activate"),
  confirm: cueList("ui-confirm"),
  cancel: cueList("ui-cancel"),
});

/** Resolves the one combat phase that has a distinct audible attack cue. */
export function soundCuesForEvent(event: GameEvent): readonly SoundCue[] {
  if (event.type === "combat-phase-changed") {
    return event.phase === "attack" ? cueList("combat-attack") : cueList();
  }
  return SOUND_EVENT_CUES[event.type];
}

export interface SoundBuffer {
  readonly native?: unknown;
  readonly id?: string;
}

export interface SoundAudioDestination {
  readonly native: unknown;
}

export interface SoundAudioGain {
  readonly native?: unknown;
  setGain(value: number): void;
  connect(destination: SoundAudioDestination): void;
}

export interface SoundAudioSource {
  buffer: SoundBuffer | null;
  onEnded: (() => void) | undefined;
  connect(destination: SoundAudioGain): void;
  start(): void;
  stop(): void;
}

export interface SoundAudioContext {
  readonly state: "closed" | "interrupted" | "running" | "suspended";
  readonly destination: SoundAudioDestination;
  createGain(): SoundAudioGain;
  createBufferSource(): SoundAudioSource;
  decodeAudioData(data: ArrayBuffer): Promise<SoundBuffer>;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}

export interface SoundAudioRuntime {
  createContext(): SoundAudioContext | undefined;
  load(url: string): Promise<ArrayBuffer>;
}

export interface SoundEffectsDiagnostics {
  readonly status: SoundStatus;
  readonly sessionId: string | null;
  readonly lastTransitionStep: number;
  readonly pendingCues: readonly SoundCue[];
  readonly deliveredCues: readonly SoundCue[];
  readonly playedCues: readonly SoundCue[];
  readonly failedCues: readonly SoundCue[];
  readonly activeSourceCount: number;
}

export interface SoundEffectsOptions {
  readonly runtime?: SoundAudioRuntime;
  readonly assetUrls?: Readonly<Record<SoundCue, string>>;
  readonly onStatusChange?: (status: SoundStatus) => void;
}

export interface SoundEffects extends SoundPort {
  readDiagnostics(): SoundEffectsDiagnostics;
}

function browserAudioContextConstructor():
  (new () => AudioContext) | undefined {
  const browserGlobals = globalThis as typeof globalThis & {
    webkitAudioContext?: new () => AudioContext;
  };
  return browserGlobals.AudioContext ?? browserGlobals.webkitAudioContext;
}

function createBrowserAudioRuntime(): SoundAudioRuntime {
  return Object.freeze({
    createContext(): SoundAudioContext | undefined {
      const Constructor = browserAudioContextConstructor();
      if (Constructor === undefined) return undefined;
      try {
        const nativeContext = new Constructor();
        const destination: SoundAudioDestination = {
          native: nativeContext.destination,
        };
        return Object.freeze({
          get state() {
            return nativeContext.state;
          },
          destination,
          createGain(): SoundAudioGain {
            const nativeGain = nativeContext.createGain();
            return Object.freeze({
              native: nativeGain,
              setGain(value: number): void {
                nativeGain.gain.value = value;
              },
              connect(nextDestination: SoundAudioDestination): void {
                nativeGain.connect(nextDestination.native as AudioNode);
              },
            });
          },
          createBufferSource(): SoundAudioSource {
            const nativeSource = nativeContext.createBufferSource();
            let ended: (() => void) | undefined;
            return {
              get buffer(): SoundBuffer | null {
                return nativeSource.buffer === null
                  ? null
                  : { native: nativeSource.buffer };
              },
              set buffer(nextBuffer: SoundBuffer | null) {
                nativeSource.buffer =
                  nextBuffer === null
                    ? null
                    : (nextBuffer.native as AudioBuffer);
              },
              get onEnded(): (() => void) | undefined {
                return ended;
              },
              set onEnded(nextEnded: (() => void) | undefined) {
                ended = nextEnded;
                nativeSource.onended =
                  nextEnded === undefined ? null : () => nextEnded();
              },
              connect(nextGain: SoundAudioGain): void {
                nativeSource.connect(nextGain.native as AudioNode);
              },
              start(): void {
                nativeSource.start();
              },
              stop(): void {
                try {
                  nativeSource.stop();
                } catch {
                  // A source may already have ended. Stopping remains best effort.
                }
              },
            };
          },
          async decodeAudioData(data: ArrayBuffer): Promise<SoundBuffer> {
            return { native: await nativeContext.decodeAudioData(data) };
          },
          resume(): Promise<void> {
            return nativeContext.resume();
          },
          suspend(): Promise<void> {
            return nativeContext.suspend();
          },
        });
      } catch {
        return undefined;
      }
    },
    load(url: string): Promise<ArrayBuffer> {
      return fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error(`Sound asset request failed: ${response.status}`);
        }
        return response.arrayBuffer();
      });
    },
  });
}

function retain<T>(values: T[], value: T): void {
  values.push(value);
  if (values.length > MAX_RETAINED_CUES) values.shift();
}

function isRunning(context: SoundAudioContext): boolean {
  return context.state === "running";
}

function resultFor(
  status: SoundStatus,
  failedCues: ReadonlySet<SoundCue>,
): SoundInitializationResult {
  const resolvedStatus =
    status === "uninitialized" || status === "loading" ? "unavailable" : status;
  return Object.freeze({
    status: resolvedStatus,
    failedCues: Object.freeze([...failedCues]),
  });
}

/** Web Audio adapter with lazy, failure-tolerant decoding and session isolation. */
export function createBrowserSoundEffects(
  options: SoundEffectsOptions = {},
): SoundEffects {
  const runtime = options.runtime ?? createBrowserAudioRuntime();
  const assetUrls = options.assetUrls ?? SOUND_CUE_ASSET_URLS;
  let status: SoundStatus = "uninitialized";
  let context: SoundAudioContext | undefined;
  let masterGain: SoundAudioGain | undefined;
  let baseStatus: Exclude<
    SoundStatus,
    "uninitialized" | "loading" | "suspended"
  > = "unavailable";
  let initialization: Promise<SoundInitializationResult> | undefined;
  let preferences: SoundPreferences = Object.freeze({
    muted: false,
    volume: 1,
  });
  let visible = true;
  let sessionId: string | null = null;
  let lastTransitionStep = -1;
  let pendingCues: SoundCue[] = [];
  let deliveredCues: SoundCue[] = [];
  let playedCues: SoundCue[] = [];
  const failedCues = new Set<SoundCue>();
  const buffers = new Map<SoundCue, SoundBuffer>();
  const activeSources = new Set<SoundAudioSource>();

  const notifyStatus = (nextStatus: SoundStatus): void => {
    status = nextStatus;
    options.onStatusChange?.(nextStatus);
  };

  options.onStatusChange?.(status);

  const audible = (): boolean =>
    visible && !preferences.muted && preferences.volume > 0;

  const stopSources = (): void => {
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // Audio teardown cannot be allowed to interrupt gameplay or navigation.
      }
    }
    activeSources.clear();
  };

  const drain = (): void => {
    if (
      context === undefined ||
      context.state !== "running" ||
      !audible() ||
      masterGain === undefined
    ) {
      return;
    }

    const queued = pendingCues;
    pendingCues = [];
    for (let index = 0; index < queued.length; index += 1) {
      const cue = queued[index];
      if (cue === undefined) continue;
      const buffer = buffers.get(cue);
      if (buffer === undefined) {
        if (!failedCues.has(cue)) {
          for (const remainingCue of queued.slice(index)) {
            retain(pendingCues, remainingCue);
          }
          break;
        }
        continue;
      }
      let source: SoundAudioSource | undefined;
      try {
        const currentSource = context.createBufferSource();
        source = currentSource;
        currentSource.buffer = buffer;
        currentSource.connect(masterGain);
        currentSource.onEnded = () => activeSources.delete(currentSource);
        activeSources.add(currentSource);
        currentSource.start();
        retain(playedCues, cue);
      } catch {
        if (source !== undefined) activeSources.delete(source);
        if (status !== "unavailable" && status !== "failed") {
          notifyStatus("degraded");
        }
      }
    }
  };

  const resume = async (): Promise<void> => {
    if (context === undefined || !visible) return;
    if (context.state !== "running") {
      try {
        await context.resume();
      } catch {
        notifyStatus("suspended");
        return;
      }
      if (!isRunning(context)) {
        notifyStatus("suspended");
        return;
      }
    }
    if (baseStatus === "ready" || baseStatus === "degraded") {
      notifyStatus(baseStatus);
      drain();
    }
  };

  const initializeInternal = async (): Promise<SoundInitializationResult> => {
    if (context !== undefined) {
      await resume();
      return resultFor(status, failedCues);
    }

    notifyStatus("loading");
    try {
      context = runtime.createContext();
    } catch {
      context = undefined;
    }
    if (context === undefined) {
      baseStatus = "unavailable";
      notifyStatus("unavailable");
      return resultFor(status, failedCues);
    }

    try {
      masterGain = context.createGain();
      masterGain.setGain(preferences.muted ? 0 : preferences.volume);
      masterGain.connect(context.destination);
    } catch {
      context = undefined;
      masterGain = undefined;
      baseStatus = "failed";
      notifyStatus("failed");
      return resultFor(status, failedCues);
    }

    const urlsToCues = new Map<string, SoundCue[]>();
    for (const cue of SOUND_CUES) {
      const url = assetUrls[cue];
      const cues = urlsToCues.get(url) ?? [];
      cues.push(cue);
      urlsToCues.set(url, cues);
    }

    await Promise.all(
      [...urlsToCues.entries()].map(async ([url, cues]) => {
        try {
          const buffer = await context!.decodeAudioData(
            await runtime.load(url),
          );
          for (const cue of cues) buffers.set(cue, buffer);
        } catch {
          for (const cue of cues) failedCues.add(cue);
        }
      }),
    );

    baseStatus =
      buffers.size === 0
        ? "failed"
        : failedCues.size > 0
          ? "degraded"
          : "ready";
    pendingCues = pendingCues.filter((cue) => !failedCues.has(cue));
    notifyStatus(visible ? baseStatus : "suspended");
    await resume();
    return resultFor(status, failedCues);
  };

  const initialize = (): Promise<SoundInitializationResult> => {
    if (initialization !== undefined) return initialization;
    initialization = initializeInternal().finally(() => {
      initialization = undefined;
    });
    return initialization;
  };

  const enqueue = (cue: SoundCue): void => {
    retain(deliveredCues, cue);
    if (!audible()) return;
    if (status === "unavailable" || status === "failed") return;
    if (context !== undefined && context.state === "running") {
      pendingCues.push(cue);
      drain();
      return;
    }
    retain(pendingCues, cue);
  };

  return Object.freeze({
    initialize,
    setPreferences(nextPreferences: Readonly<SoundPreferences>): void {
      preferences = Object.freeze({
        muted: nextPreferences.muted,
        volume:
          Number.isFinite(nextPreferences.volume) && nextPreferences.volume > 0
            ? Math.min(1, nextPreferences.volume)
            : 0,
      });
      try {
        masterGain?.setGain(preferences.muted ? 0 : preferences.volume);
      } catch {
        if (status !== "unavailable" && status !== "failed") {
          notifyStatus("degraded");
        }
      }
      if (!audible()) {
        pendingCues = [];
        stopSources();
      }
    },
    setSession(nextSessionId: string | null): void {
      if (sessionId === nextSessionId) return;
      stopSources();
      pendingCues = [];
      deliveredCues = [];
      playedCues = [];
      lastTransitionStep = -1;
      sessionId = nextSessionId;
    },
    presentTransition(
      nextSessionId: string,
      step: number,
      events: readonly GameEvent[],
    ): void {
      if (
        sessionId !== nextSessionId ||
        !Number.isInteger(step) ||
        step <= lastTransitionStep
      ) {
        return;
      }
      lastTransitionStep = step;
      for (const event of events) {
        for (const cue of soundCuesForEvent(event)) enqueue(cue);
      }
    },
    presentUiAction(action: SoundUiAction): void {
      for (const cue of SOUND_UI_ACTION_CUES[action]) enqueue(cue);
    },
    setVisible(nextVisible: boolean): void {
      if (visible === nextVisible) return;
      visible = nextVisible;
      if (!visible) {
        pendingCues = [];
        stopSources();
        if (context?.state === "running") {
          try {
            void context.suspend().catch(() => {});
          } catch {
            // Visibility changes must remain best effort.
          }
        }
        if (status === "ready" || status === "degraded")
          notifyStatus("suspended");
        return;
      }
      void resume();
    },
    stop(): void {
      pendingCues = [];
      stopSources();
    },
    readDiagnostics(): SoundEffectsDiagnostics {
      return Object.freeze({
        status,
        sessionId,
        lastTransitionStep,
        pendingCues: Object.freeze([...pendingCues]),
        deliveredCues: Object.freeze([...deliveredCues]),
        playedCues: Object.freeze([...playedCues]),
        failedCues: Object.freeze([...failedCues]),
        activeSourceCount: activeSources.size,
      });
    },
  });
}
