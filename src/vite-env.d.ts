/// <reference types="vite/client" />

import type { GameplayTrace } from "./application/gameplay-execution.js";

declare global {
  interface Window {
    triggerKnightDiagnostics?: Readonly<{
      read(): GameplayTrace;
    }>;
  }
}
