/// <reference types="vite/client" />

import type { GameplayTrace } from "./application/gameplay-execution.js";
import type { SoundEffectsDiagnostics } from "./sound/sound-effects.js";

declare global {
  interface Window {
    triggerKnightDiagnostics?: Readonly<{
      read(): GameplayTrace;
    }>;
    triggerKnightSoundDiagnostics?: Readonly<{
      read(): SoundEffectsDiagnostics;
    }>;
  }
}
