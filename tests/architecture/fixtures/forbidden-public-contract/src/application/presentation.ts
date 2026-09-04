import type { RunState } from "../contracts.js";

interface PresentationFrame {
  readonly state: RunState;
}

interface PresentationPort {
  present(state: RunState): void;
}

export type { PresentationFrame, PresentationPort };
