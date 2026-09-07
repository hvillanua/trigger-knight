import type { GameEvent, GameObservation } from "../domain/contracts.js";

/** @playerVisible */
export interface PresentationFrame {
  readonly previous: Readonly<GameObservation>;
  readonly current: Readonly<GameObservation>;
  readonly interpolation: number;
  readonly events: readonly GameEvent[];
}

/** @playerVisible */
export interface PresentationPort {
  present(frame: PresentationFrame): void;
}
