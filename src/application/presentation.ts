import type { GameEvent, GameView } from "../domain/contracts.js";

export interface PresentationFrame {
  readonly previous: Readonly<GameView>;
  readonly current: Readonly<GameView>;
  readonly interpolation: number;
  readonly events: readonly GameEvent[];
}

/** Output boundary implemented by browser presentation adapters. */
export interface PresentationPort {
  present(frame: PresentationFrame): void;
}
