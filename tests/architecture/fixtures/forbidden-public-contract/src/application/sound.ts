import type { RunState } from "../contracts.js";

interface SoundPort {
  initialize(state: RunState): void;
}

export type { SoundPort };
