import type {
  CommittedRunResultView,
  RunTerminalReason,
} from "../application/contracts.js";

/** @playerVisible Public values shown while a completed save is unavailable. */
export interface PendingCompletedRunView {
  readonly terminalReason: RunTerminalReason;
  readonly score: number;
  readonly profileExpEarned: number;
}

export type CompletionPresentationStatus =
  "committed" | "already-committed" | "failed" | "uncertain";

/** @playerVisible Browser result presentation boundary options. */
export interface CompletedRunPresentationOptions {
  readonly onRetry: () => void;
  readonly onNextRun: () => void;
}

function requiredElement<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing completed-run result element ${selector}`);
  }
  return element;
}

function terminalReasonLabel(reason: RunTerminalReason): string {
  return reason === "combat" ? "Combat defeat" : "Lifespan depleted";
}

function numberLabel(value: number): string {
  return String(value);
}

const SCORE_COUNT_DURATION_MS = 2_500;

/** @playerVisible Renders only the committed public result. */
export class CompletedRunPresentation {
  readonly #root: HTMLElement;
  readonly #scoreCard: HTMLElement;
  readonly #saveStatus: HTMLElement;
  readonly #saveError: HTMLElement;
  readonly #terminalReason: HTMLElement;
  readonly #score: HTMLElement;
  readonly #scoreCount: HTMLElement;
  readonly #scoreLabel: HTMLElement;
  readonly #cardHighScore: HTMLElement;
  readonly #newHighScore: HTMLElement;
  readonly #levelLabel: HTMLElement;
  readonly #experience: HTMLElement;
  readonly #experienceFill: HTMLElement;
  readonly #skipScoreCount: HTMLButtonElement;
  readonly #profileLevel: HTMLElement;
  readonly #profileXp: HTMLElement;
  readonly #profileMultiplier: HTMLElement;
  readonly #profileHighScore: HTMLElement;
  readonly #levelChange: HTMLElement;
  readonly #xpChange: HTMLElement;
  readonly #multiplierChange: HTMLElement;
  readonly #highScoreChange: HTMLElement;
  readonly #collections: HTMLElement;
  readonly #achievementCount: HTMLElement;
  readonly #achievements: HTMLElement;
  readonly #progress: HTMLElement;
  readonly #retry: HTMLButtonElement;
  readonly #nextRun: HTMLButtonElement;
  readonly #onRetry: () => void;
  readonly #onNextRun: () => void;
  #scoreFrame: number | undefined;
  #finalExperience:
    Readonly<{ readonly xp: number; readonly threshold: number }> | undefined;
  #reducedMotion = false;

  constructor(root: HTMLElement, options: CompletedRunPresentationOptions) {
    this.#root = root;
    this.#scoreCard = requiredElement(root, ".result-score-card");
    this.#saveStatus = requiredElement(root, "#result-save-status");
    this.#saveError = requiredElement(root, "#result-save-error");
    this.#terminalReason = requiredElement(root, "#result-terminal-reason");
    this.#score = requiredElement(root, "#result-score");
    this.#scoreCount = requiredElement(root, "#result-score-count");
    this.#scoreLabel = requiredElement(root, "#result-score-label");
    this.#scoreLabel.textContent = "SCORE GET";
    this.#cardHighScore = requiredElement(root, "#result-card-high-score");
    this.#newHighScore = requiredElement(root, "#result-new-high-score");
    this.#levelLabel = requiredElement(root, "#result-level-label");
    this.#experience = requiredElement(root, "#result-experience");
    this.#experienceFill = requiredElement(root, "#result-xp-fill");
    this.#skipScoreCount = requiredElement(root, "#skip-score-count");
    this.#profileLevel = requiredElement(root, "#result-profile-level");
    this.#profileXp = requiredElement(root, "#result-profile-xp");
    this.#profileMultiplier = requiredElement(
      root,
      "#result-profile-multiplier",
    );
    this.#profileHighScore = requiredElement(
      root,
      "#result-profile-high-score",
    );
    this.#levelChange = requiredElement(root, "#result-level-change");
    this.#xpChange = requiredElement(root, "#result-xp-change");
    this.#multiplierChange = requiredElement(root, "#result-multiplier-change");
    this.#highScoreChange = requiredElement(root, "#result-high-score-change");
    this.#collections = requiredElement(root, "#result-collections");
    this.#achievementCount = requiredElement(root, "#result-achievement-count");
    this.#achievements = requiredElement(root, "#result-achievements");
    this.#progress = requiredElement(root, "#result-progress");
    this.#retry = requiredElement(root, "#retry-completed-run");
    this.#nextRun = requiredElement(root, "#next-run");
    this.#onRetry = options.onRetry;
    this.#onNextRun = options.onNextRun;

    this.#skipScoreCount.addEventListener("click", () => {
      this.#finishScoreCount();
    });
    this.#retry.addEventListener("click", () => {
      this.#onRetry();
    });
    this.#nextRun.addEventListener("click", () => {
      this.#onNextRun();
    });
    this.#root.dataset.reducedMotion = "false";
  }

  /** Completes optional result animation when the user prefers less motion. */
  setReducedMotion(reducedMotion: boolean): void {
    this.#reducedMotion = reducedMotion;
    this.#root.dataset.reducedMotion = String(reducedMotion);
    if (reducedMotion && this.#scoreFrame !== undefined) {
      this.#finishScoreCount();
    }
  }

  reset(): void {
    this.#cancelScoreCount();
    this.#root.hidden = true;
    this.#root.dataset.resultState = "hidden";
    this.#scoreCard.dataset.scoreState = "idle";
    this.#finalExperience = undefined;
    this.#root.removeAttribute("aria-busy");
  }

  showCommitted(
    result: CommittedRunResultView,
    status: "committed" | "already-committed",
  ): void {
    this.#root.hidden = false;
    this.#root.dataset.resultState = "committed";
    this.#root.dataset.completionStatus = status;
    this.#root.setAttribute("aria-busy", "false");
    this.#saveStatus.textContent = "Progress saved.";
    this.#saveError.textContent = "";
    this.#saveError.hidden = true;
    this.#terminalReason.textContent = terminalReasonLabel(
      result.run.terminalReason,
    );
    this.#score.textContent = numberLabel(result.run.score);
    this.#renderCommittedProfile(result);
    this.#retry.hidden = true;
    this.#nextRun.hidden = false;
    this.#nextRun.disabled = false;
    this.#beginScoreCount(result);
  }

  showPending(
    run: PendingCompletedRunView,
    status: "failed" | "uncertain",
    errorCode: string,
  ): void {
    this.#cancelScoreCount();
    this.#root.hidden = false;
    this.#root.dataset.resultState = status;
    this.#root.dataset.completionStatus = status;
    this.#root.setAttribute("aria-busy", "false");
    this.#saveStatus.textContent =
      status === "uncertain"
        ? "Progress save is pending; retry before starting another run."
        : "Progress was not saved; retry before starting another run.";
    this.#saveError.textContent = `Storage status: ${errorCode}`;
    this.#saveError.hidden = false;
    this.#terminalReason.textContent = terminalReasonLabel(run.terminalReason);
    this.#score.textContent = numberLabel(run.score);
    this.#scoreCard.dataset.scoreState = "pending";
    this.#levelLabel.textContent = "Level —";
    this.#experience.textContent = "—/— EXP";
    this.#experienceFill.style.width = "0%";
    this.#finalExperience = undefined;
    this.#cardHighScore.textContent = "Highscore : —";
    this.#newHighScore.hidden = true;
    this.#scoreCount.textContent = "Not counted";
    this.#scoreCount.dataset.state = "not-counted";
    this.#skipScoreCount.hidden = true;
    this.#renderPendingProfile(run.profileExpEarned);
    this.#retry.hidden = false;
    this.#nextRun.hidden = false;
    this.#nextRun.disabled = true;
  }

  #renderCommittedProfile(result: CommittedRunResultView): void {
    const profile = result.profile;
    this.#profileLevel.textContent = numberLabel(profile.level);
    this.#profileXp.textContent = numberLabel(profile.xp);
    this.#profileMultiplier.textContent = numberLabel(profile.scoreMultiplier);
    this.#profileHighScore.textContent = numberLabel(profile.highScore);
    this.#levelLabel.textContent = `Level ${profile.level} (x${profile.scoreMultiplier} Score)`;
    this.#cardHighScore.textContent = `Highscore : ${profile.highScore}`;
    this.#newHighScore.hidden =
      result.progression.highScore.after <= result.progression.highScore.before;
    this.#renderExperience(
      result.progression.xp.before,
      profile.experienceThreshold,
    );
    this.#finalExperience = Object.freeze({
      xp: profile.xp,
      threshold: profile.experienceThreshold,
    });
    this.#levelChange.textContent = `${result.progression.level.before} → ${result.progression.level.after}`;
    this.#xpChange.textContent = `${result.progression.xp.before} → ${result.progression.xp.after} (+${result.run.profileExpEarned})`;
    this.#multiplierChange.textContent = `${result.progression.scoreMultiplier.before} → ${result.progression.scoreMultiplier.after}`;
    this.#highScoreChange.textContent = `${result.progression.highScore.before} → ${result.progression.highScore.after}`;
    this.#collections.textContent =
      `Weapons ${profile.collections.weaponsDiscovered}/${profile.collections.weaponsTotal}; ` +
      `armor ${profile.collections.armorDiscovered}/${profile.collections.armorTotal}`;
    this.#achievementCount.textContent = `${profile.achievements.unlockedCount}/${profile.achievements.total}`;
    this.#achievements.replaceChildren();
    if (profile.achievements.unlocked.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "None yet";
      this.#achievements.append(empty);
    } else {
      for (const achievement of profile.achievements.unlocked) {
        const item = document.createElement("li");
        item.textContent = achievement;
        this.#achievements.append(item);
      }
    }
    this.#progress.textContent =
      `Collection ${profile.progress.collectionPoints}; ` +
      `achievements ${profile.progress.achievementPoints}; ` +
      `total ${profile.progress.totalPoints}`;
  }

  #renderPendingProfile(profileExpEarned: number): void {
    this.#profileLevel.textContent = "Not saved";
    this.#profileXp.textContent = `+${profileExpEarned} pending`;
    this.#profileMultiplier.textContent = "Not saved";
    this.#profileHighScore.textContent = "Not saved";
    this.#levelChange.textContent = "Not saved";
    this.#xpChange.textContent = "Not saved";
    this.#multiplierChange.textContent = "Not saved";
    this.#highScoreChange.textContent = "Not saved";
    this.#collections.textContent = "Not saved";
    this.#achievementCount.textContent = "Not saved";
    this.#achievements.replaceChildren();
    const pending = document.createElement("li");
    pending.textContent = "Not saved";
    this.#achievements.append(pending);
    this.#progress.textContent = "Not saved";
  }

  #beginScoreCount(result: CommittedRunResultView): void {
    this.#cancelScoreCount();
    const score = result.run.score;
    const startingXp = result.progression.xp.before;
    const endingXp = result.progression.xp.after;
    const experienceThreshold = result.profile.experienceThreshold;
    if (score <= 0 || this.#reducedMotion) {
      this.#finishScoreCount();
      return;
    }

    this.#scoreCard.dataset.scoreState = "counting";
    this.#scoreCount.textContent = "0";
    this.#scoreCount.dataset.state = "counting";
    this.#skipScoreCount.hidden = false;
    const startedAt = performance.now();
    const animate = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / SCORE_COUNT_DURATION_MS);
      this.#scoreCount.textContent = numberLabel(Math.floor(score * progress));
      this.#renderExperience(
        Math.round(startingXp + (endingXp - startingXp) * progress),
        experienceThreshold,
      );
      if (progress >= 1) {
        this.#finishScoreCount();
        return;
      }
      this.#scoreFrame = requestAnimationFrame(animate);
    };
    this.#scoreFrame = requestAnimationFrame(animate);
  }

  #finishScoreCount(): void {
    this.#cancelScoreCount();
    this.#scoreCount.textContent = this.#score.textContent ?? "0";
    this.#scoreCount.dataset.state = "complete";
    this.#scoreCard.dataset.scoreState = "complete";
    if (this.#finalExperience !== undefined) {
      this.#renderExperience(
        this.#finalExperience.xp,
        this.#finalExperience.threshold,
      );
    }
    this.#skipScoreCount.hidden = true;
  }

  #renderExperience(xp: number, threshold: number): void {
    const safeThreshold = Math.max(1, threshold);
    const safeXp = Math.max(0, xp);
    this.#experience.textContent = `${safeXp}/${safeThreshold} EXP`;
    this.#experienceFill.style.width = `${Math.min(100, (safeXp / safeThreshold) * 100)}%`;
  }

  #cancelScoreCount(): void {
    if (this.#scoreFrame !== undefined) {
      cancelAnimationFrame(this.#scoreFrame);
      this.#scoreFrame = undefined;
    }
  }
}
