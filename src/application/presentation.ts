import type { GameEvent, GameObservation } from "../domain/contracts.js";

export interface PresentationFrame {
  readonly previous: Readonly<GameObservation>;
  readonly current: Readonly<GameObservation>;
  readonly interpolation: number;
  readonly events: readonly GameEvent[];
}

/** Output boundary implemented by browser presentation adapters. */
export interface PresentationPort {
  present(frame: PresentationFrame): void;
}
