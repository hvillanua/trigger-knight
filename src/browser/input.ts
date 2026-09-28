import type { GameCommand, SoundChannel } from "../application/contracts.js";
import type { ActionEligibility } from "../application/contracts.js";
import {
  isReservedKeyboardCode,
  isSupportedKeyboardCode,
  type KeyboardCode,
  type InputBindings,
  type RawInputBindings,
} from "../application/settings.js";
import {
  PURCHASE_CURRENT_ENCOUNTER_COMMANDS,
  TOGGLE_PAUSE_COMMANDS,
  USE_CARRIED_ITEM_COMMANDS,
} from "../application/commands.js";

const NO_COMMANDS: readonly GameCommand[] = Object.freeze([]);
const INPUT_ACTIONS = Object.freeze([
  "togglePause",
  "dismissTutorial",
  "purchaseCurrentEncounter",
  "useCarriedItem",
] as const);

export type InputAction = (typeof INPUT_ACTIONS)[number];

export function soundChannelForQuickControl(code: string): SoundChannel | null {
  if (code === "KeyM") return "music";
  if (code === "KeyS") return "effects";
  return null;
}

const DISMISS_TUTORIAL_COMMAND = Object.freeze({
  type: "dismiss-tutorial" as const,
});
const DISMISS_TUTORIAL_COMMANDS: readonly GameCommand[] = Object.freeze([
  DISMISS_TUTORIAL_COMMAND,
]);

/** Keeps the temporary manual clock control outside gameplay intent. */
export function commandsForAdvanceActivation(): readonly GameCommand[] {
  return NO_COMMANDS;
}

/** Maps the browser tutorial control to the shared semantic command. */
export function commandsForDismissTutorialActivation(): readonly GameCommand[] {
  return DISMISS_TUTORIAL_COMMANDS;
}

/** Maps a browser pause activation to the shared semantic command. */
export function commandsForTogglePauseActivation(): readonly GameCommand[] {
  return TOGGLE_PAUSE_COMMANDS;
}

/** Maps a browser activation to the shared semantic purchase command. */
export function commandsForPurchaseActivation(): readonly GameCommand[] {
  return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
}

/** Maps a browser activation to the shared semantic item-use command. */
export function commandsForItemUseActivation(): readonly GameCommand[] {
  return USE_CARRIED_ITEM_COMMANDS;
}

function actionEligibility(
  action: InputAction,
  eligibility: Readonly<ActionEligibility>,
): boolean {
  switch (action) {
    case "togglePause":
      return eligibility.canTogglePause;
    case "dismissTutorial":
      return eligibility.canDismissTutorial;
    case "purchaseCurrentEncounter":
      return eligibility.canPurchaseCurrentEncounter;
    case "useCarriedItem":
      return eligibility.canUseCarriedItem;
  }
}

function commandsForAction(action: InputAction): readonly GameCommand[] {
  switch (action) {
    case "togglePause":
      return TOGGLE_PAUSE_COMMANDS;
    case "dismissTutorial":
      return DISMISS_TUTORIAL_COMMANDS;
    case "purchaseCurrentEncounter":
      return PURCHASE_CURRENT_ENCOUNTER_COMMANDS;
    case "useCarriedItem":
      return USE_CARRIED_ITEM_COMMANDS;
  }
}

/** Maps a KeyboardEvent.code through saved bindings and public eligibility. */
export function commandsForKeyboardActivation(
  code: string,
  bindings: Readonly<InputBindings>,
  eligibility: Readonly<ActionEligibility>,
): readonly GameCommand[] {
  for (const action of INPUT_ACTIONS) {
    if (bindings[action] === code) {
      return actionEligibility(action, eligibility)
        ? commandsForAction(action)
        : NO_COMMANDS;
    }
  }
  return NO_COMMANDS;
}

/** Stateful keyboard adapter whose only mutable value is the saved binding set. */
export interface KeyboardCommandRouter {
  replaceBindings(bindings: Readonly<InputBindings>): void;
  commandsFor(
    code: string,
    eligibility: Readonly<ActionEligibility>,
  ): readonly GameCommand[];
}

export function createKeyboardCommandRouter(
  initialBindings: Readonly<InputBindings>,
): KeyboardCommandRouter {
  let bindings: InputBindings = Object.freeze({ ...initialBindings });
  return Object.freeze({
    replaceBindings(nextBindings: Readonly<InputBindings>): void {
      bindings = Object.freeze({ ...nextBindings });
    },
    commandsFor(
      code: string,
      eligibility: Readonly<ActionEligibility>,
    ): readonly GameCommand[] {
      return commandsForKeyboardActivation(code, bindings, eligibility);
    },
  });
}

export type BindingCaptureResult =
  | Readonly<{
      status: "captured";
      action: InputAction;
      code: KeyboardCode;
      bindings: InputBindings;
    }>
  | Readonly<{ status: "cancelled"; action: InputAction }>
  | Readonly<{
      status: "conflict";
      action: InputAction;
      code: KeyboardCode;
      conflictingAction: InputAction;
    }>
  | Readonly<{ status: "unsupported"; action: InputAction; code: string }>
  | Readonly<{
      status: "reserved";
      action: InputAction;
      code: KeyboardCode;
    }>
  | Readonly<{ status: "ignored" }>;

export interface BindingCaptureController {
  begin(action: InputAction): void;
  cancel(): BindingCaptureResult;
  activeAction(): InputAction | null;
  handleKeyDown(code: string): BindingCaptureResult;
  replaceBindings(bindings: Readonly<InputBindings>): void;
  bindings(): InputBindings;
}

/** Captures one key at a time and keeps conflicts explicit until resolved. */
export function createBindingCaptureController(
  initialBindings: Readonly<InputBindings>,
): BindingCaptureController {
  let bindings: InputBindings = Object.freeze({ ...initialBindings });
  let active: InputAction | null = null;

  const cancel = (): BindingCaptureResult => {
    if (active === null) return Object.freeze({ status: "ignored" });
    const action = active;
    active = null;
    return Object.freeze({ status: "cancelled", action });
  };

  return Object.freeze({
    begin(action: InputAction): void {
      active = action;
    },
    cancel,
    activeAction: () => active,
    handleKeyDown(code: string): BindingCaptureResult {
      if (active === null) return Object.freeze({ status: "ignored" });
      if (code === "Escape") return cancel();
      const action = active;
      if (isReservedKeyboardCode(code)) {
        return Object.freeze({ status: "reserved", action, code });
      }
      if (!isSupportedKeyboardCode(code)) {
        return Object.freeze({ status: "unsupported", action, code });
      }
      const conflictingAction = INPUT_ACTIONS.find(
        (candidate) => candidate !== action && bindings[candidate] === code,
      );
      if (conflictingAction !== undefined) {
        return Object.freeze({
          status: "conflict",
          action,
          code,
          conflictingAction,
        });
      }
      bindings = Object.freeze({ ...bindings, [action]: code });
      active = null;
      return Object.freeze({ status: "captured", action, code, bindings });
    },
    replaceBindings(nextBindings: Readonly<InputBindings>): void {
      bindings = Object.freeze({ ...nextBindings });
      active = null;
    },
    bindings: () => bindings,
  });
}

/** Finds the first duplicate saved or draft binding, if one exists. */
export function findBindingConflict(
  bindings: Readonly<RawInputBindings>,
): Readonly<{ code: string; actions: readonly InputAction[] }> | null {
  for (const action of INPUT_ACTIONS) {
    const actions = INPUT_ACTIONS.filter(
      (candidate) => bindings[candidate] === bindings[action],
    );
    if (actions.length > 1) {
      return Object.freeze({
        code: bindings[action],
        actions: Object.freeze(actions),
      });
    }
  }
  return null;
}

/** Gives settings and gameplay prompts a short, readable binding name. */
export function bindingLabel(code: string): string {
  if (code === "Space") return "Space";
  if (code === "Enter") return "Enter";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}
