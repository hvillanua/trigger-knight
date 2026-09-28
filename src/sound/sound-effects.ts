import type {
  GameEvent,
  SoundChannel,
  SoundCue,
  SoundInitializationResult,
  SoundPort,
  SoundStatus,
  SoundUiAction,
  TutorialPage,
} from "../application/contracts.js";
import type { SoundPreferences } from "../application/settings.js";

const MAX_RETAINED_CUES = 256;
const MUSIC_TARGET_GAIN = 0.9;
const SOUND_FADE_STEPS = 60;
const SOUND_FADE_INTERVAL_MS = 1000 / 30;
const SCORE_CUE_INTERVAL_MS = 1000 / 30;

export const ORIGINAL_SOUND_ASSET_FILE_NAMES = Object.freeze({
  applause: "513_SFXApplause.mp3",
  battleStart: "514_SFXBattleStart.mp3",
  buttonPress: "515_SFXButtonPress.mp3",
  buttonSelect: "516_SFXButtonSelect.mp3",
  characterDeath: "517_SFXCharaDie.mp3",
  enemyDeath: "518_SFXEnemyDie.mp3",
  error: "519_SFXError.mp3",
  event: "520_SFXEvent.mp3",
  eventTriggered: "521_SFXEventTriggered.mp3",
  experienceLoop: "522_SFXEXPLoop.mp3",
  hit01: "523_SFXHit01.mp3",
  hit02: "524_SFXHit02.mp3",
  hit03: "525_SFXHit03.mp3",
  itemUse: "526_SFXItemUse.mp3",
  notice: "527_SFXNotice.mp3",
  gameMusic: "512_BGMGame.mp3",
} as const);

const assetUrl = (fileName: string): string =>
  new URL(`../assets/original/sounds/${fileName}`, import.meta.url).href;

export const GAME_MUSIC_ASSET_URL = assetUrl(
  ORIGINAL_SOUND_ASSET_FILE_NAMES.gameMusic,
);

export const SOUND_CUES: readonly SoundCue[] = Object.freeze([
  "applause",
  "battle-start",
  "button-press",
  "button-select",
  "character-death",
  "enemy-death",
  "error",
  "event",
  "event-triggered",
  "experience-loop",
  "hit-01",
  "hit-02",
  "hit-03",
  "item-use",
  "notice",
]);

export const SOUND_CUE_ASSET_URLS: Readonly<Record<SoundCue, string>> =
  Object.freeze({
    applause: assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.applause),
    "battle-start": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.battleStart),
    "button-press": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.buttonPress),
    "button-select": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.buttonSelect),
    "character-death": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.characterDeath),
    "enemy-death": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.enemyDeath),
    error: assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.error),
    event: assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.event),
    "event-triggered": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.eventTriggered),
    "experience-loop": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.experienceLoop),
    "hit-01": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.hit01),
    "hit-02": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.hit02),
    "hit-03": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.hit03),
    "item-use": assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.itemUse),
    notice: assetUrl(ORIGINAL_SOUND_ASSET_FILE_NAMES.notice),
  });

const cueList = (...cues: SoundCue[]): readonly SoundCue[] =>
  Object.freeze(cues);

export const SOUND_EVENT_CUES: Readonly<
  Record<GameEvent["type"], readonly SoundCue[]>
> = Object.freeze({
  "achievement-unlocked": cueList(),
  "battle-reward": cueList("event-triggered"),
  "battle-started": cueList("battle-start"),
  "combat-phase-changed": cueList(),
  "combat-hit": cueList("hit-01"),
  "combat-lethal-hit": cueList("enemy-death"),
  "equipment-discovered": cueList(),
  "encounter-promoted": cueList(),
  "item-use-rejected": cueList("error"),
  "item-used": cueList("item-use"),
  "lifespan-death": cueList("character-death"),
  "pause-toggled": cueList(),
  "purchase-rejected": cueList("error"),
  "run-ended": cueList(),
  "shop-purchased": cueList("event-triggered"),
  "shop-departed": cueList(),
  "step-advanced": cueList(),
  "tutorial-dismissed": cueList("button-press"),
});

export const SOUND_UI_ACTION_CUES: Readonly<
  Record<SoundUiAction, readonly SoundCue[]>
> = Object.freeze({
  activate: cueList("button-press"),
  confirm: cueList("button-press"),
  cancel: cueList("button-press"),
  select: cueList("button-select"),
});

const HIT_CUES = Object.freeze(["hit-01", "hit-02", "hit-03"] as const);

function cueForHitVariant(hitVariant: number): SoundCue {
  const normalized = Math.abs(Math.trunc(hitVariant)) % HIT_CUES.length;
  return HIT_CUES[normalized] ?? "hit-01";
}

export function soundCuesForEvent(event: GameEvent): readonly SoundCue[] {
  if (event.type === "encounter-promoted") {
    return event.encounter.kind === "shop" ? cueList("event") : cueList();
  }
  if (event.type === "run-ended") {
    return event.reason === "combat" ? cueList("character-death") : cueList();
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
  rampToGain(value: number, durationSeconds: number): void;
  connect(destination: SoundAudioDestination | SoundAudioGain): void;
}

export interface SoundAudioSource {
  buffer: SoundBuffer | null;
  loop: boolean;
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
  readonly musicPlaying: boolean;
  readonly soundEffectsMuted: boolean;
  readonly scoreLoopPlaying: boolean;
}

export interface SoundEffectsOptions {
  readonly runtime?: SoundAudioRuntime;
  readonly assetUrls?: Readonly<Record<SoundCue, string>>;
  readonly musicAssetUrl?: string;
  readonly onStatusChange?: (status: SoundStatus) => void;
}

export interface SoundEffects extends SoundPort {
  readDiagnostics(): SoundEffectsDiagnostics;
}

function browserAudioContextConstructor():
  (new () => AudioContext) | undefined {
  const browserGlobals: typeof globalThis & {
    webkitAudioContext?: new () => AudioContext;
  } = globalThis;
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
            let currentGain = 0;
            return Object.freeze({
              native: nativeGain,
              setGain(value: number): void {
                nativeGain.gain.cancelScheduledValues(
                  nativeContext.currentTime,
                );
                nativeGain.gain.setValueAtTime(
                  value,
                  nativeContext.currentTime,
                );
                currentGain = value;
              },
              rampToGain(value: number, durationSeconds: number): void {
                const now = nativeContext.currentTime;
                nativeGain.gain.cancelScheduledValues(now);
                nativeGain.gain.setValueAtTime(currentGain, now);
                nativeGain.gain.linearRampToValueAtTime(
                  value,
                  now + durationSeconds,
                );
                currentGain = value;
              },
              connect(
                nextDestination: SoundAudioDestination | SoundAudioGain,
              ): void {
                if (!(nextDestination.native instanceof AudioNode)) {
                  throw new TypeError("Invalid browser audio destination");
                }
                nativeGain.connect(nextDestination.native);
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
                if (nextBuffer === null) {
                  nativeSource.buffer = null;
                  return;
                }
                if (!(nextBuffer.native instanceof AudioBuffer)) {
                  throw new TypeError("Invalid browser audio buffer");
                }
                nativeSource.buffer = nextBuffer.native;
              },
              get loop(): boolean {
                return nativeSource.loop;
              },
              set loop(nextLoop: boolean) {
                nativeSource.loop = nextLoop;
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
                if (!(nextGain.native instanceof AudioNode)) {
                  throw new TypeError("Invalid browser audio gain");
                }
                nativeSource.connect(nextGain.native);
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

interface ChannelPlayback {
  muted: boolean;
  gain: SoundAudioGain | undefined;
  level: number;
  fadeTimer: ReturnType<typeof setTimeout> | undefined;
}

export function createBrowserSoundEffects(
  options: SoundEffectsOptions = {},
): SoundEffects {
  const runtime = options.runtime ?? createBrowserAudioRuntime();
  const assetUrls = options.assetUrls ?? SOUND_CUE_ASSET_URLS;
  const musicAssetUrl = options.musicAssetUrl ?? GAME_MUSIC_ASSET_URL;
  let status: SoundStatus = "uninitialized";
  let context: SoundAudioContext | undefined;
  let masterGain: SoundAudioGain | undefined;
  const channels: Record<SoundChannel, ChannelPlayback> = {
    music: { muted: false, gain: undefined, level: 0, fadeTimer: undefined },
    effects: { muted: false, gain: undefined, level: 1, fadeTimer: undefined },
  };
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
  let musicBuffer: SoundBuffer | undefined;
  let musicFailed = false;
  let musicSource: SoundAudioSource | undefined;
  let scoreCueTimer: ReturnType<typeof setInterval> | undefined;
  let musicRequested = false;
  let scoreCounting = false;
  let nextHitVariant = 0;

  const notifyStatus = (nextStatus: SoundStatus): void => {
    status = nextStatus;
    options.onStatusChange?.(nextStatus);
  };

  options.onStatusChange?.(status);

  const effectsMuted = (): boolean =>
    preferences.muted || channels.effects.muted;

  const audible = (): boolean =>
    visible && !effectsMuted() && preferences.volume > 0;

  const stopOneShotSources = (): void => {
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // Audio teardown cannot be allowed to interrupt gameplay or navigation.
      }
    }
    activeSources.clear();
  };

  const clearFade = (channel: ChannelPlayback): void => {
    if (channel.fadeTimer !== undefined) {
      clearTimeout(channel.fadeTimer);
      channel.fadeTimer = undefined;
    }
  };

  const setChannelLevel = (channel: ChannelPlayback, level: number): void => {
    clearFade(channel);
    channel.level = level;
    channel.gain?.setGain(level);
  };

  const fadeChannel = (
    channel: ChannelPlayback,
    target: number,
    onComplete: () => void,
    steps = SOUND_FADE_STEPS,
  ): void => {
    clearFade(channel);
    const initialLevel = channel.level;
    const startedAt = Date.now();
    const durationMs = Math.round(steps * SOUND_FADE_INTERVAL_MS);
    let step = 0;
    const failed = (): void => {
      clearFade(channel);
      if (status !== "unavailable" && status !== "failed") {
        notifyStatus("degraded");
      }
    };
    const schedule = (): void => {
      const deadline = startedAt + (durationMs * (step + 1)) / steps;
      channel.fadeTimer = setTimeout(tick, Math.ceil(deadline - Date.now()));
    };
    const tick = (): void => {
      channel.fadeTimer = undefined;
      step += 1;
      channel.level =
        step === steps
          ? target
          : initialLevel + ((target - initialLevel) * step) / steps;
      try {
        channel.gain?.setGain(channel.level);
        if (step < steps) {
          channel.gain?.rampToGain(
            target,
            (durationMs * (steps - step)) / steps / 1000,
          );
        }
      } catch {
        failed();
        return;
      }
      if (step === steps) {
        onComplete();
      } else {
        schedule();
      }
    };
    try {
      channel.gain?.rampToGain(target, durationMs / 1000);
      schedule();
    } catch {
      failed();
    }
  };

  const stopMusicSource = (): void => {
    clearFade(channels.music);
    const source = musicSource;
    musicSource = undefined;
    if (source === undefined) return;
    try {
      source.stop();
    } catch {
      // Audio teardown remains best effort.
    }
  };

  const stopScoreCueTimer = (): void => {
    if (scoreCueTimer === undefined) return;
    clearInterval(scoreCueTimer);
    scoreCueTimer = undefined;
  };

  const stopEffects = (): void => {
    pendingCues = [];
    scoreCounting = false;
    stopOneShotSources();
    stopScoreCueTimer();
    try {
      setChannelLevel(channels.effects, effectsMuted() ? 0 : 1);
    } catch {
      // Audio teardown cannot be allowed to interrupt gameplay or navigation.
    }
  };

  const stopAllSources = (): void => {
    stopEffects();
    stopMusicSource();
  };

  const drain = (): void => {
    if (
      context === undefined ||
      context.state !== "running" ||
      !audible() ||
      channels.effects.gain === undefined
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
        currentSource.loop = false;
        currentSource.connect(channels.effects.gain);
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

  const startMusicSource = (fadeSteps = SOUND_FADE_STEPS): void => {
    if (
      !musicRequested ||
      channels.music.muted ||
      musicSource !== undefined ||
      context === undefined ||
      context.state !== "running" ||
      !visible ||
      musicBuffer === undefined ||
      channels.music.gain === undefined
    ) {
      return;
    }
    try {
      const source = context.createBufferSource();
      source.buffer = musicBuffer;
      source.loop = true;
      source.connect(channels.music.gain);
      source.onEnded = () => {
        if (musicSource === source) musicSource = undefined;
      };
      musicSource = source;
      source.start();
      setChannelLevel(channels.music, 0);
      fadeChannel(channels.music, MUSIC_TARGET_GAIN, () => {}, fadeSteps);
    } catch {
      musicSource = undefined;
      if (status !== "unavailable" && status !== "failed") {
        notifyStatus("degraded");
      }
    }
  };

  const playScoreCue = (): void => {
    if (
      !scoreCounting ||
      context === undefined ||
      context.state !== "running" ||
      !audible() ||
      buffers.get("experience-loop") === undefined ||
      channels.effects.gain === undefined
    ) {
      return;
    }
    try {
      const source = context.createBufferSource();
      source.buffer = buffers.get("experience-loop") ?? null;
      source.loop = false;
      source.connect(channels.effects.gain);
      source.onEnded = () => activeSources.delete(source);
      activeSources.add(source);
      source.start();
      retain(playedCues, "experience-loop");
    } catch {
      if (status !== "unavailable" && status !== "failed") {
        notifyStatus("degraded");
      }
    }
  };

  const startScoreCueTimer = (): void => {
    if (scoreCueTimer !== undefined) return;
    if (
      !scoreCounting ||
      context === undefined ||
      context.state !== "running" ||
      !audible() ||
      buffers.get("experience-loop") === undefined ||
      channels.effects.gain === undefined
    ) {
      return;
    }
    playScoreCue();
    scoreCueTimer = setInterval(playScoreCue, SCORE_CUE_INTERVAL_MS);
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
      startMusicSource();
      startScoreCueTimer();
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
    const audioContext = context;

    try {
      masterGain = context.createGain();
      channels.effects.gain = context.createGain();
      channels.music.gain = context.createGain();
      masterGain.setGain(preferences.volume);
      setChannelLevel(channels.effects, effectsMuted() ? 0 : 1);
      channels.music.gain.setGain(channels.music.level);
      channels.effects.gain.connect(masterGain);
      channels.music.gain.connect(masterGain);
      masterGain.connect(context.destination);
    } catch {
      context = undefined;
      masterGain = undefined;
      channels.effects.gain = undefined;
      channels.music.gain = undefined;
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

    await Promise.all([
      ...[...urlsToCues.entries()].map(async ([url, cues]) => {
        try {
          const buffer = await audioContext.decodeAudioData(
            await runtime.load(url),
          );
          for (const cue of cues) buffers.set(cue, buffer);
        } catch {
          for (const cue of cues) failedCues.add(cue);
        }
      }),
      (async () => {
        try {
          musicBuffer = await audioContext.decodeAudioData(
            await runtime.load(musicAssetUrl),
          );
        } catch {
          musicFailed = true;
        }
      })(),
    ]);

    const hasAnyAudio = buffers.size > 0 || musicBuffer !== undefined;
    baseStatus = !hasAnyAudio
      ? "failed"
      : failedCues.size > 0 || musicFailed
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
    toggleChannel(channel: SoundChannel): void {
      const playback = channels[channel];
      playback.muted = !playback.muted;
      clearFade(playback);
      if (channel === "music") {
        if (playback.muted) {
          fadeChannel(playback, 0, () => {});
        } else if (musicSource === undefined) {
          startMusicSource(SOUND_FADE_STEPS);
        } else {
          fadeChannel(playback, MUSIC_TARGET_GAIN, () => {});
        }
        return;
      }
      if (effectsMuted()) {
        pendingCues = [];
        stopScoreCueTimer();
        fadeChannel(playback, 0, stopOneShotSources);
      } else {
        fadeChannel(playback, 1, () => {});
        startScoreCueTimer();
      }
    },
    setPreferences(nextPreferences: Readonly<SoundPreferences>): void {
      const wasMuted = effectsMuted();
      preferences = Object.freeze({
        muted: nextPreferences.muted,
        volume:
          Number.isFinite(nextPreferences.volume) && nextPreferences.volume > 0
            ? Math.min(1, nextPreferences.volume)
            : 0,
      });
      try {
        masterGain?.setGain(preferences.volume);
        if (wasMuted !== effectsMuted()) {
          if (effectsMuted()) {
            pendingCues = [];
            stopScoreCueTimer();
            fadeChannel(channels.effects, 0, stopOneShotSources);
          } else {
            fadeChannel(channels.effects, 1, startScoreCueTimer);
          }
        }
      } catch {
        if (status !== "unavailable" && status !== "failed") {
          notifyStatus("degraded");
        }
      }
      if (!audible()) {
        pendingCues = [];
        if (wasMuted === effectsMuted()) {
          stopOneShotSources();
          stopScoreCueTimer();
        }
      } else if (wasMuted === effectsMuted()) {
        startScoreCueTimer();
      }
    },
    setSession(nextSessionId: string | null): void {
      if (sessionId === nextSessionId) return;
      const preserveMusic = sessionId !== null && nextSessionId !== null;
      stopEffects();
      if (!preserveMusic) {
        musicRequested = false;
        stopMusicSource();
      }
      deliveredCues = [];
      playedCues = [];
      lastTransitionStep = -1;
      nextHitVariant = 0;
      sessionId = nextSessionId;
    },
    startGameplayMusic(): void {
      if (sessionId === null) return;
      musicRequested = true;
      void initialize();
      startMusicSource();
    },
    presentTutorial(): void {
      enqueue("notice");
    },
    presentTransition(
      nextSessionId: string,
      step: number,
      events: readonly GameEvent[],
      tutorialPage?: TutorialPage,
    ): void {
      if (
        sessionId !== nextSessionId ||
        !Number.isInteger(step) ||
        step <= lastTransitionStep
      ) {
        return;
      }
      lastTransitionStep = step;
      let tutorialPresented = false;
      const presentTutorialBeforeEvent = (): void => {
        if (tutorialPage === 3 && !tutorialPresented) {
          tutorialPresented = true;
          enqueue("notice");
        }
      };
      for (const event of events) {
        presentTutorialBeforeEvent();
        const cues =
          event.type === "combat-hit"
            ? cueList(cueForHitVariant(nextHitVariant))
            : soundCuesForEvent(event);
        for (const cue of cues) {
          enqueue(cue);
        }
        if (event.type === "combat-hit") {
          nextHitVariant = (nextHitVariant + 1) % HIT_CUES.length;
          if (tutorialPage === 5 && !tutorialPresented) {
            tutorialPresented = true;
            enqueue("notice");
          }
        }
      }
      if (tutorialPage !== undefined && !tutorialPresented) {
        enqueue("notice");
      }
    },
    presentUiAction(action: SoundUiAction): void {
      for (const cue of SOUND_UI_ACTION_CUES[action]) enqueue(cue);
    },
    presentResult(): void {
      enqueue("applause");
    },
    setScoreCounting(counting: boolean): void {
      scoreCounting = counting;
      if (!counting) {
        stopScoreCueTimer();
        return;
      }
      void initialize();
      startScoreCueTimer();
    },
    setVisible(nextVisible: boolean): void {
      if (visible === nextVisible) return;
      visible = nextVisible;
      if (!visible) {
        pendingCues = [];
        stopOneShotSources();
        stopScoreCueTimer();
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
    stopEffects(): void {
      stopEffects();
    },
    stop(): void {
      musicRequested = false;
      stopAllSources();
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
        activeSourceCount:
          activeSources.size + (musicSource === undefined ? 0 : 1),
        musicPlaying: musicSource !== undefined && !channels.music.muted,
        soundEffectsMuted: effectsMuted(),
        scoreLoopPlaying: scoreCueTimer !== undefined,
      });
    },
  });
}
