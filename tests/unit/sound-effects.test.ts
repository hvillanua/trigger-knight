import { describe, expect, it, vi } from "vitest";

import type { GameEvent } from "../../src/application/contracts.js";
import {
  createBrowserSoundEffects,
  soundCuesForEvent,
  type SoundAudioContext,
  type SoundAudioGain,
  type SoundAudioRuntime,
  type SoundAudioSource,
  type SoundBuffer,
} from "../../src/sound/sound-effects.js";

class FakeSource implements SoundAudioSource {
  buffer: SoundBuffer | null = null;
  onEnded: (() => void) | undefined;
  loop = false;
  started = false;
  stopped = false;

  connect(): void {}

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
    this.onEnded?.();
  }
}

class FakeGain implements SoundAudioGain {
  readonly setGain = vi.fn<(value: number) => void>();
  readonly rampToGain =
    vi.fn<(value: number, durationSeconds: number) => void>();

  connect(): void {}
}

class FakeContext implements SoundAudioContext {
  state: "closed" | "interrupted" | "running" | "suspended" = "running";
  currentTime = 0;
  readonly destination = { native: undefined };
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  readonly suspend = vi.fn(() => {
    this.state = "suspended";
    return Promise.resolve();
  });

  createGain(): SoundAudioGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource(): SoundAudioSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  decodeAudioData(data: ArrayBuffer): Promise<SoundBuffer> {
    return Promise.resolve({ id: String(data.byteLength) });
  }
}

function event(type: GameEvent["type"]): GameEvent {
  switch (type) {
    case "battle-started":
      return {
        type,
        enemy: { id: "goblin", maximumHp: 100, currentHp: 100 },
      };
    case "battle-reward":
      return {
        type,
        enemy: "goblin",
        gold: 10,
        score: 20,
        profileExp: 2,
        dragonKilled: false,
      };
    case "combat-phase-changed":
      return { type, actor: "hero", phase: "attack" };
    case "combat-hit":
      return {
        type,
        attacker: "hero",
        target: "enemy",
        damage: 10,
        critical: false,
        remainingHp: 90,
      };
    case "combat-lethal-hit":
      return { type, attacker: "hero", target: "enemy" };
    case "encounter-promoted":
      return {
        type,
        encounter: {
          kind: "shop",
          shop: "pharmacy",
          cachedPrice: 10,
          x: 100,
          used: false,
        },
      };
    case "equipment-discovered":
      return { type, equipment: "weapon", tier: 2 };
    case "achievement-unlocked":
      return { type, achievement: "reach-day-10" };
    case "lifespan-death":
      return { type };
    case "pause-toggled":
      return { type, paused: true };
    case "purchase-rejected":
      return { type, reason: "insufficient-gold" };
    case "item-use-rejected":
      return { type, reason: "no-item" };
    case "item-used":
      return { type, item: "elixir" };
    case "shop-departed":
      return { type, shop: "pharmacy" };
    case "shop-purchased":
      return { type, shop: "pharmacy", price: 10 };
    case "tutorial-dismissed":
      return { type, page: 0 };
    case "run-ended":
      return { type, reason: "lifespan" };
    case "step-advanced":
      return { type, step: 1 };
  }
}

function setup() {
  const context = new FakeContext();
  const runtime: SoundAudioRuntime = {
    createContext: () => context,
    load: () => Promise.resolve(new ArrayBuffer(8)),
  };
  const sound = createBrowserSoundEffects({ runtime });
  return { context, sound };
}

describe("sound cue mapping", () => {
  it("maps public gameplay outcomes to the original sound symbols", () => {
    expect(soundCuesForEvent(event("battle-started"))).toEqual([
      "battle-start",
    ]);
    expect(soundCuesForEvent(event("combat-phase-changed"))).toEqual([]);
    expect(soundCuesForEvent(event("combat-hit"))).toEqual(["hit-01"]);
    expect(soundCuesForEvent(event("shop-purchased"))).toEqual([
      "event-triggered",
    ]);
    expect(soundCuesForEvent(event("item-used"))).toEqual(["item-use"]);
    expect(soundCuesForEvent(event("battle-reward"))).toEqual([
      "event-triggered",
    ]);
    expect(soundCuesForEvent(event("lifespan-death"))).toEqual([
      "character-death",
    ]);
    expect(soundCuesForEvent(event("run-ended"))).toEqual([]);
    expect(soundCuesForEvent({ type: "run-ended", reason: "combat" })).toEqual([
      "character-death",
    ]);
    expect(soundCuesForEvent(event("achievement-unlocked"))).toEqual([]);
    expect(soundCuesForEvent(event("encounter-promoted"))).toEqual(["event"]);
    expect(soundCuesForEvent(event("step-advanced"))).toEqual([]);
  });

  it("uses the staged original sound exports for every cue", async () => {
    const { SOUND_CUE_ASSET_URLS, GAME_MUSIC_ASSET_URL } =
      await import("../../src/sound/sound-effects.js");

    expect(GAME_MUSIC_ASSET_URL).toContain(
      "/assets/original/sounds/512_BGMGame.mp3",
    );
    expect(Object.values(SOUND_CUE_ASSET_URLS)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("513_SFXApplause.mp3"),
        expect.stringContaining("515_SFXButtonPress.mp3"),
        expect.stringContaining("516_SFXButtonSelect.mp3"),
        expect.stringContaining("523_SFXHit01.mp3"),
        expect.stringContaining("524_SFXHit02.mp3"),
        expect.stringContaining("525_SFXHit03.mp3"),
        expect.stringContaining("527_SFXNotice.mp3"),
      ]),
    );
  });
});

describe("browser sound effects", () => {
  it("delivers each transition once and keeps event order between renders", async () => {
    const { context, sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");

    sound.presentTransition("run-1", 4, [event("shop-purchased")]);
    sound.presentTransition("run-1", 4, [event("shop-purchased")]);
    sound.presentTransition("run-1", 5, [
      event("item-used"),
      event("battle-reward"),
    ]);

    expect(sound.readDiagnostics().deliveredCues).toEqual([
      "event-triggered",
      "item-use",
      "event-triggered",
    ]);
    expect(sound.readDiagnostics().playedCues).toEqual([
      "event-triggered",
      "item-use",
      "event-triggered",
    ]);
    expect(context.sources.filter((source) => source.started)).toHaveLength(3);
  });

  it("inserts tutorial notice at the original event boundary", async () => {
    const { sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");

    sound.presentTransition(
      "run-1",
      1,
      [event("combat-hit"), event("combat-lethal-hit")],
      5,
    );

    expect(sound.readDiagnostics().deliveredCues).toEqual([
      "hit-01",
      "notice",
      "enemy-death",
    ]);

    sound.setSession("run-2");
    sound.presentTransition("run-2", 1, [event("battle-started")], 3);
    expect(sound.readDiagnostics().deliveredCues).toEqual([
      "notice",
      "battle-start",
    ]);
  });

  it("retains a first-interaction cue while assets are decoding", async () => {
    const context = new FakeContext();
    const releases: Array<() => void> = [];
    const runtime: SoundAudioRuntime = {
      createContext: () => context,
      load: () =>
        new Promise<ArrayBuffer>((resolve) => {
          releases.push(() => resolve(new ArrayBuffer(8)));
        }),
    };
    const sound = createBrowserSoundEffects({ runtime });
    const initialization = sound.initialize();

    sound.presentUiAction("activate");
    expect(sound.readDiagnostics().pendingCues).toEqual(["button-press"]);
    for (const release of releases) release();
    await initialization;

    expect(sound.readDiagnostics().playedCues).toEqual(["button-press"]);
  });

  it("preserves cue order when later assets decode first", async () => {
    const context = new FakeContext();
    let releaseBattle: (() => void) | undefined;
    let releaseItem: (() => void) | undefined;
    const runtime: SoundAudioRuntime = {
      createContext: () => context,
      load: (url) => {
        if (url.endsWith("514_SFXBattleStart.mp3")) {
          return new Promise<ArrayBuffer>((resolve) => {
            releaseBattle = () => resolve(new ArrayBuffer(8));
          });
        }
        if (url.endsWith("526_SFXItemUse.mp3")) {
          return new Promise<ArrayBuffer>((resolve) => {
            releaseItem = () => resolve(new ArrayBuffer(8));
          });
        }
        return Promise.resolve(new ArrayBuffer(8));
      },
    };
    const sound = createBrowserSoundEffects({ runtime });
    const initialization = sound.initialize();
    releaseItem?.();
    await Promise.resolve();
    await Promise.resolve();
    sound.setSession("run-1");
    sound.presentTransition("run-1", 1, [
      event("battle-started"),
      event("item-used"),
    ]);
    expect(sound.readDiagnostics().playedCues).toEqual([]);

    releaseBattle?.();
    await initialization;

    expect(sound.readDiagnostics().playedCues).toEqual([
      "battle-start",
      "item-use",
    ]);
  });

  it("stops old-session playback and ignores stale transitions", async () => {
    const { context, sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");
    sound.presentTransition("run-1", 1, [event("battle-started")]);
    const oldSource = context.sources[0];

    sound.setSession("run-2");
    sound.presentTransition("run-1", 2, [event("shop-purchased")]);
    sound.presentTransition("run-2", 1, [event("item-used")]);

    expect(oldSource?.stopped).toBe(true);
    expect(sound.readDiagnostics().deliveredCues).toEqual(["item-use"]);
  });

  it("preserves music while the result screen starts the next session", async () => {
    const { context, sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");
    sound.startGameplayMusic();
    sound.presentTransition("run-1", 1, [event("battle-started")]);

    const musicSource = context.sources.find((source) => source.loop);
    const effectSource = context.sources.find((source) => !source.loop);
    expect(musicSource).toBeDefined();
    expect(effectSource).toBeDefined();

    sound.setSession("run-2");

    expect(musicSource?.stopped).toBe(false);
    expect(effectSource?.stopped).toBe(true);
    expect(sound.readDiagnostics().musicPlaying).toBe(true);

    sound.setSession(null);
    expect(musicSource?.stopped).toBe(true);
    expect(sound.readDiagnostics().musicPlaying).toBe(false);
  });

  it("fades music without restarting the source when the channel is toggled", async () => {
    vi.useFakeTimers();
    try {
      const { context, sound } = setup();
      await sound.initialize();
      sound.setSession("run-1");
      sound.startGameplayMusic();

      const musicSource = context.sources.find((source) => source.loop);
      const musicGain = context.gains[2];
      expect(musicSource).toBeDefined();
      expect(musicGain).toBeDefined();
      expect(musicGain?.rampToGain).toHaveBeenLastCalledWith(0.9, 2);

      context.currentTime = 2;
      vi.advanceTimersByTime(2_000);
      sound.toggleChannel("music");
      expect(musicGain?.rampToGain).toHaveBeenLastCalledWith(0, 2);

      context.currentTime = 3;
      vi.advanceTimersByTime(1_000);
      sound.toggleChannel("music");
      expect(musicSource?.stopped).toBe(false);
      expect(sound.readDiagnostics().musicPlaying).toBe(true);

      context.currentTime = 5;
      vi.advanceTimersByTime(2_000);
      expect(musicSource?.stopped).toBe(false);

      sound.toggleChannel("music");
      expect(sound.readDiagnostics().musicPlaying).toBe(false);
      context.currentTime = 6.999;
      vi.advanceTimersByTime(1_999);
      expect(musicSource?.stopped).toBe(false);

      context.currentTime = 7;
      vi.advanceTimersByTime(1);
      expect(musicSource?.stopped).toBe(false);
      expect(context.sources.filter((source) => source.loop)).toEqual([
        musicSource,
      ]);

      sound.stop();
      expect(musicSource?.stopped).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fades active sound effects out over two seconds without affecting music", async () => {
    vi.useFakeTimers();
    try {
      const { context, sound } = setup();
      await sound.initialize();
      sound.setSession("run-1");
      sound.startGameplayMusic();
      sound.presentTransition("run-1", 1, [event("battle-started")]);

      const musicSource = context.sources.find((source) => source.loop);
      const effectSource = context.sources.find((source) => !source.loop);
      expect(musicSource).toBeDefined();
      expect(effectSource).toBeDefined();

      sound.toggleChannel("effects");
      context.currentTime = 1.999;
      vi.advanceTimersByTime(1_999);
      expect(effectSource?.stopped).toBe(false);
      expect(musicSource?.stopped).toBe(false);

      context.currentTime = 2;
      vi.advanceTimersByTime(1);
      expect(effectSource?.stopped).toBe(true);
      expect(musicSource?.stopped).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("suspends and resumes visibly without replaying hidden cues", async () => {
    const { context, sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");
    sound.presentTransition("run-1", 1, [event("battle-started")]);
    sound.setVisible(false);
    sound.presentTransition("run-1", 2, [event("shop-purchased")]);
    sound.setVisible(true);
    await Promise.resolve();

    expect(context.suspend).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(sound.readDiagnostics().deliveredCues).toEqual([
      "battle-start",
      "event-triggered",
    ]);
    expect(sound.readDiagnostics().playedCues).toEqual(["battle-start"]);
  });

  it("keeps controls independent from playback and reports unavailable audio", async () => {
    const status = vi.fn();
    const sound = createBrowserSoundEffects({
      runtime: { createContext: () => undefined, load: vi.fn() },
      onStatusChange: status,
    });

    sound.setPreferences({ muted: true, volume: 0.25 });
    sound.presentUiAction("activate");
    await expect(sound.initialize()).resolves.toMatchObject({
      status: "unavailable",
    });
    expect(sound.readDiagnostics().deliveredCues).toEqual(["button-press"]);
    expect(status).toHaveBeenCalledWith("unavailable");
  });

  it("continues with available cues when one asset cannot decode", async () => {
    const context = new FakeContext();
    let calls = 0;
    const runtime: SoundAudioRuntime = {
      createContext: () => context,
      load: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new Error("decode fixture failure"));
        }
        return Promise.resolve(new ArrayBuffer(8));
      },
    };
    const sound = createBrowserSoundEffects({ runtime });

    await expect(sound.initialize()).resolves.toMatchObject({
      status: "degraded",
    });
    sound.setSession("run-1");
    sound.presentTransition("run-1", 1, [event("shop-purchased")]);

    expect(sound.readDiagnostics().status).toBe("degraded");
    expect(sound.readDiagnostics().failedCues.length).toBeGreaterThan(0);
  });

  it("plays persistent original music and result sounds on their lifecycle hooks", async () => {
    const { context, sound } = setup();
    await sound.initialize();
    sound.setSession("run-1");

    sound.startGameplayMusic();
    sound.presentTutorial();
    sound.presentResult();
    sound.setScoreCounting(true);

    expect(sound.readDiagnostics().musicPlaying).toBe(true);
    expect(sound.readDiagnostics().scoreLoopPlaying).toBe(true);
    expect(sound.readDiagnostics().deliveredCues).toEqual([
      "notice",
      "applause",
    ]);
    expect(context.sources.filter((source) => source.loop)).toHaveLength(1);

    sound.setScoreCounting(false);
    sound.startGameplayMusic();
    sound.stopEffects();
    expect(sound.readDiagnostics().musicPlaying).toBe(true);
    sound.stop();

    expect(sound.readDiagnostics().musicPlaying).toBe(false);
    expect(sound.readDiagnostics().scoreLoopPlaying).toBe(false);
  });

  it("repeats the score cue at the original presentation cadence", async () => {
    vi.useFakeTimers();
    try {
      const { context, sound } = setup();
      await sound.initialize();
      sound.setSession("run-1");
      sound.setScoreCounting(true);

      expect(context.sources.filter((source) => !source.loop)).toHaveLength(1);
      vi.advanceTimersByTime(70);
      expect(context.sources.filter((source) => !source.loop)).toHaveLength(3);

      sound.setScoreCounting(false);
      vi.advanceTimersByTime(1000);
      expect(context.sources.filter((source) => !source.loop)).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
