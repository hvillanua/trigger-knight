interface MergeHiddenState {
  readonly diagnosticSeed: number;
}

interface GameObservation {
  readonly turn: number;
}

interface GameObservation {
  readonly hidden: MergeHiddenState;
}

export type { GameObservation };
