import type {
  BrowserSettings,
  CompletedRunSettlementInput,
  CompletedRunResult,
  CompletedRunCoordinator,
  GameCommand,
  GameObservation,
  GameplayEngine,
  GameplayTrace,
  PresentationPort,
  ProfileState,
  RunConfig,
  SoundPort,
} from "../application/contracts.js";
import {
  createBrowserGameplayClock,
  type BrowserGameplayClock,
} from "./gameplay-clock.js";
import {
  createBrowserGameplaySession,
  type BrowserDispatchResult,
  type BrowserGameplaySession,
  type BrowserGameplaySessionOptions,
} from "./gameplay-session.js";

export interface ActiveRunStartOptions {
  readonly focus?: boolean;
  readonly startImmediately?: boolean;
}

export interface ActiveRunCompletion {
  readonly settlement: Readonly<CompletedRunSettlementInput> | undefined;
  readonly commit: CompletedRunResult | undefined;
  readonly sessionOverDismissed: boolean;
}

export interface BrowserActiveRunControllerOptions {
  readonly gameplayEngine: GameplayEngine;
  readonly presentation: PresentationPort;
  readonly completedRunCoordinator: CompletedRunCoordinator;
  readonly sound: SoundPort;
  readonly ruleset: RunConfig["ruleset"];
  readonly manualClock: boolean;
  readonly retainDiagnostics: boolean;
  readonly devSeedOverride: string | undefined;
  readonly isGameplayScreen: () => boolean;
  readonly readSettings: () => Readonly<BrowserSettings>;
  readonly onPrimeSound: () => void;
  readonly onRunStarted: (
    profile: Readonly<ProfileState>,
    focus: boolean,
  ) => void;
  readonly onInitialObservation: (
    observation: Readonly<GameObservation>,
  ) => void;
  readonly onTransition: (result: BrowserDispatchResult) => void;
  readonly onCompletionChanged: (completion: ActiveRunCompletion) => void;
  readonly createCompletionId?: () => string;
  readonly createSession?: BrowserGameplaySessionFactory;
  readonly createClock?: BrowserGameplayClockFactory;
}

export interface BrowserActiveRunController {
  start(profile: Readonly<ProfileState>, options?: ActiveRunStartOptions): void;
  stop(): void;
  dispatch(commands: readonly GameCommand[]): void;
  render(interpolation: number): void;
  setVisible(visible: boolean): void;
  suspend(): void;
  resume(): void;
  dismissSessionOver(): boolean;
  commitCurrentRun(): CompletedRunResult | undefined;
  readObservation(): Readonly<GameObservation> | undefined;
  readCompletion(): ActiveRunCompletion | undefined;
  readDiagnostics(): GameplayTrace;
}

export type BrowserGameplaySessionFactory = (
  engine: GameplayEngine,
  config: RunConfig,
  presentation: PresentationPort,
  options: BrowserGameplaySessionOptions,
) => BrowserGameplaySession;

export type BrowserGameplayClockFactory = (
  session: Pick<BrowserGameplaySession, "dispatch" | "render">,
) => BrowserGameplayClock;

interface ActiveRunRecord {
  readonly completionId: string;
  readonly initialProfile: Readonly<ProfileState>;
  session: BrowserGameplaySession | undefined;
  clock: BrowserGameplayClock | undefined;
  lastObservation: Readonly<GameObservation> | undefined;
  settlement: Readonly<CompletedRunSettlementInput> | undefined;
  commit: CompletedRunResult | undefined;
  sessionOverDismissed: boolean;
}

function defaultCompletionId(): string {
  return window.crypto.randomUUID();
}

function defaultClockFactory(
  session: Pick<BrowserGameplaySession, "dispatch" | "render">,
): BrowserGameplayClock {
  return createBrowserGameplayClock(session, {
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
  });
}

function completionView(
  record: Readonly<ActiveRunRecord>,
): ActiveRunCompletion {
  return Object.freeze({
    settlement: record.settlement,
    commit: record.commit,
    sessionOverDismissed: record.sessionOverDismissed,
  });
}

/** Owns one browser run, its clock/session, and completed-run settlement. */
export function createBrowserActiveRunController(
  options: BrowserActiveRunControllerOptions,
): BrowserActiveRunController {
  const createSession =
    options.createSession ??
    ((engine, config, presentation, sessionOptions) =>
      createBrowserGameplaySession(
        engine,
        config,
        presentation,
        sessionOptions,
      ));
  const createClock = options.createClock ?? defaultClockFactory;
  const createCompletionId = options.createCompletionId ?? defaultCompletionId;
  let activeRun: ActiveRunRecord | undefined;
  let runNumber = 0;

  const publishCompletion = (record: Readonly<ActiveRunRecord>): void => {
    options.onCompletionChanged(completionView(record));
  };

  const commit = (record: ActiveRunRecord): CompletedRunResult | undefined => {
    if (record.settlement === undefined || activeRun !== record) {
      return undefined;
    }
    record.commit = options.completedRunCoordinator.commit({
      completionId: record.completionId,
      initialProfile: record.initialProfile,
      run: record.settlement,
    });
    publishCompletion(record);
    return record.commit;
  };

  const stop = (): void => {
    activeRun?.clock?.stop();
    activeRun = undefined;
    options.sound.setSession(null);
  };

  return Object.freeze({
    start(
      profile: Readonly<ProfileState>,
      startOptions: ActiveRunStartOptions = {},
    ): void {
      activeRun?.clock?.stop();
      runNumber += 1;
      const record: ActiveRunRecord = {
        completionId: createCompletionId(),
        initialProfile: profile,
        session: undefined,
        clock: undefined,
        lastObservation: undefined,
        settlement: undefined,
        commit: undefined,
        sessionOverDismissed: false,
      };
      activeRun = record;
      options.sound.setSession(record.completionId);
      options.sound.setPreferences(options.readSettings().sound);
      options.sound.presentUiAction("activate");
      options.sound.startGameplayMusic();
      options.onRunStarted(profile, startOptions.focus ?? true);

      const seed =
        options.devSeedOverride === undefined
          ? runNumber === 1
            ? "browser-run"
            : `browser-run-${runNumber}`
          : runNumber === 1
            ? options.devSeedOverride
            : `${options.devSeedOverride}-${runNumber}`;
      const config: RunConfig = {
        ruleset: options.ruleset,
        seed,
        initialProfile: profile,
        ...(startOptions.startImmediately ? { startImmediately: true } : {}),
      };
      record.session = createSession(
        options.gameplayEngine,
        Object.freeze(config),
        options.presentation,
        {
          retainDiagnostics: options.retainDiagnostics,
          renderOnDispatch: options.manualClock,
          onTransition: (result) => {
            if (activeRun !== record) return;
            const previousObservation = record.lastObservation;
            record.lastObservation = result.observation;
            const tutorialOpened =
              previousObservation?.lifecycle.tutorialPage === null &&
              result.observation.lifecycle.tutorialPage !== null;
            options.onTransition(result);
            options.sound.presentTransition(
              record.completionId,
              result.observation.steps,
              result.events,
              tutorialOpened
                ? (result.observation.lifecycle.tutorialPage ?? undefined)
                : undefined,
            );
          },
          onCompletedRun: (run) => {
            if (activeRun !== record) return;
            record.settlement = run;
            commit(record);
          },
        },
      );
      record.lastObservation = record.session.readObservation();
      options.onInitialObservation(record.lastObservation);
      if (record.lastObservation.lifecycle.tutorialPage !== null) {
        options.sound.presentTutorial();
      }
      if (!options.manualClock) {
        record.clock = createClock(record.session);
        record.clock.setVisible(document.visibilityState === "visible");
        record.clock.start();
      }
    },
    stop,
    dispatch(commands: readonly GameCommand[]): void {
      const record = activeRun;
      if (
        record === undefined ||
        record.session === undefined ||
        !options.isGameplayScreen()
      ) {
        return;
      }
      options.onPrimeSound();
      if (options.manualClock) {
        record.session.dispatch(commands);
        record.session.render(1);
      } else {
        record.clock?.enqueue(commands);
      }
    },
    render(interpolation: number): void {
      activeRun?.session?.render(interpolation);
    },
    setVisible(visible: boolean): void {
      activeRun?.clock?.setVisible(visible);
    },
    suspend(): void {
      activeRun?.clock?.stop();
    },
    resume(): void {
      activeRun?.clock?.start();
    },
    dismissSessionOver(): boolean {
      const record = activeRun;
      if (
        !options.isGameplayScreen() ||
        record === undefined ||
        record.settlement === undefined ||
        record.commit === undefined ||
        record.session?.readObservation().lifecycle.phase !== "ended"
      ) {
        return false;
      }
      record.sessionOverDismissed = true;
      publishCompletion(record);
      return true;
    },
    commitCurrentRun(): CompletedRunResult | undefined {
      return activeRun === undefined ? undefined : commit(activeRun);
    },
    readObservation: () => activeRun?.session?.readObservation(),
    readCompletion: () =>
      activeRun === undefined ? undefined : completionView(activeRun),
    readDiagnostics(): GameplayTrace {
      const session = activeRun?.session;
      if (session === undefined) {
        throw new Error("No active browser gameplay session");
      }
      return session.readDiagnostics();
    },
  });
}
