import type {
  BrowserSettings,
  ProfileLoadResult,
  ProfileSaveResult,
  ProfileState,
  SettingsLoadResult,
  SettingsSaveResult,
  SoundUiAction,
} from "../application/contracts.js";
import {
  createDefaultSettings,
  normalizeSettings,
  SETTINGS_SCHEMA_VERSION,
} from "../application/settings.js";
import {
  bindingLabel,
  createBindingCaptureController,
  findBindingConflict,
  type BindingCaptureController,
  type InputAction,
} from "./input.js";

export interface SettingsControllerElements {
  readonly status: HTMLElement;
  readonly bindingPrompt: HTMLElement;
  readonly form: HTMLFormElement;
  readonly tutorialPreference: HTMLInputElement;
  readonly titleTutorialToggle: HTMLInputElement;
  readonly soundMuted: HTMLInputElement;
  readonly soundVolume: HTMLInputElement;
  readonly soundVolumeValue: HTMLOutputElement;
  readonly bindingInputs: Readonly<Record<InputAction, HTMLInputElement>>;
  readonly restoreDefaults: HTMLButtonElement;
  readonly remapButtons: readonly HTMLButtonElement[];
}

export interface SettingsControllerOptions {
  readonly readProfile: () => Readonly<ProfileState>;
  readonly loadProfile: () => ProfileLoadResult;
  readonly saveProfile: (profile: Readonly<ProfileState>) => ProfileSaveResult;
  readonly readSettings: () => Readonly<BrowserSettings>;
  readonly saveSettings: (settings: BrowserSettings) => SettingsSaveResult;
  readonly onProfileChanged: (profile: ProfileState) => void;
  readonly onSettingsChanged: (settings: BrowserSettings) => void;
  readonly onBindingsChanged: (
    bindings: Readonly<BrowserSettings["bindings"]>,
  ) => void;
  readonly onPrimeSound: () => void;
  readonly onUiAction: (action: SoundUiAction) => void;
}

export interface SettingsController {
  render(settings: Readonly<BrowserSettings>): void;
  prepare(): void;
  setStatus(message: string, errorCode?: string): void;
  handleKeyDown(event: KeyboardEvent): boolean;
}

function bindingActionLabel(action: InputAction): string {
  switch (action) {
    case "togglePause":
      return "Pause";
    case "dismissTutorial":
      return "Dismiss tutorial";
    case "purchaseCurrentEncounter":
      return "Purchase current encounter";
    case "useCarriedItem":
      return "Use carried item";
  }
}

function isInputAction(value: string | undefined): value is InputAction {
  return (
    value === "togglePause" ||
    value === "dismissTutorial" ||
    value === "purchaseCurrentEncounter" ||
    value === "useCarriedItem"
  );
}

export function settingsStatusText(result: SettingsLoadResult): string {
  if (result.status === "empty") {
    return "Using default settings. Save changes below when ready.";
  }
  if (result.status === "loaded") {
    return "Settings loaded.";
  }
  return `Settings unavailable. Using defaults. Storage status: ${result.error.code}`;
}

/** Owns settings form rendering, binding capture, validation, and saves. */
export function createSettingsController(
  elements: SettingsControllerElements,
  options: SettingsControllerOptions,
  initialBindings: Readonly<BrowserSettings["bindings"]>,
): SettingsController {
  const bindingCapture: BindingCaptureController =
    createBindingCaptureController(initialBindings);

  const renderKeyboardHints = (): void => {
    elements.bindingInputs.togglePause.setAttribute(
      "aria-keyshortcuts",
      bindingLabel(bindingCapture.bindings().togglePause),
    );
    elements.bindingInputs.dismissTutorial.setAttribute(
      "aria-keyshortcuts",
      bindingLabel(bindingCapture.bindings().dismissTutorial),
    );
    elements.bindingInputs.purchaseCurrentEncounter.setAttribute(
      "aria-keyshortcuts",
      bindingLabel(bindingCapture.bindings().purchaseCurrentEncounter),
    );
    elements.bindingInputs.useCarriedItem.setAttribute(
      "aria-keyshortcuts",
      bindingLabel(bindingCapture.bindings().useCarriedItem),
    );
    options.onBindingsChanged(bindingCapture.bindings());
  };

  const render = (settings: Readonly<BrowserSettings>): void => {
    bindingCapture.replaceBindings(settings.bindings);
    const tutorialsEnabled =
      options.readProfile().tutorialPreference === "enabled";
    elements.tutorialPreference.checked = tutorialsEnabled;
    elements.titleTutorialToggle.checked = tutorialsEnabled;
    elements.soundMuted.checked = settings.sound.muted;
    elements.soundVolume.value = String(settings.sound.volume);
    elements.soundVolumeValue.value = `${Math.round(settings.sound.volume * 100)}%`;
    elements.soundVolumeValue.textContent = elements.soundVolumeValue.value;
    elements.bindingInputs.togglePause.value =
      bindingCapture.bindings().togglePause;
    elements.bindingInputs.dismissTutorial.value =
      bindingCapture.bindings().dismissTutorial;
    elements.bindingInputs.purchaseCurrentEncounter.value =
      bindingCapture.bindings().purchaseCurrentEncounter;
    elements.bindingInputs.useCarriedItem.value =
      bindingCapture.bindings().useCarriedItem;
    renderKeyboardHints();
  };

  const setStatus = (message: string, errorCode?: string): void => {
    elements.status.textContent = message;
    if (errorCode === undefined) {
      delete elements.status.dataset.error;
    } else {
      elements.status.dataset.error = errorCode;
    }
  };

  const presentUiAction = (action: SoundUiAction): void => {
    options.onPrimeSound();
    options.onUiAction(action);
  };

  const handleBindingCaptureResult = (
    result: ReturnType<BindingCaptureController["handleKeyDown"]>,
  ): void => {
    switch (result.status) {
      case "captured":
        elements.bindingInputs[result.action].value = result.code;
        elements.bindingPrompt.textContent = `${bindingActionLabel(result.action)} is ${bindingLabel(result.code)}. Save settings to keep it.`;
        renderKeyboardHints();
        break;
      case "cancelled":
        elements.bindingPrompt.textContent = `${bindingActionLabel(result.action)} remapping cancelled.`;
        break;
      case "conflict":
        elements.bindingPrompt.textContent = `${bindingLabel(result.code)} is already assigned to ${bindingActionLabel(result.conflictingAction)}. Choose another key or press Escape to cancel.`;
        break;
      case "unsupported":
        elements.bindingPrompt.textContent = `${result.code || "That key"} is not supported. Choose another key or press Escape to cancel.`;
        break;
      case "ignored":
        break;
    }
  };

  const beginBindingCapture = (action: InputAction): void => {
    bindingCapture.begin(action);
    elements.bindingPrompt.textContent = `Press a key for ${bindingActionLabel(action)}. Press Escape to cancel.`;
    elements.bindingInputs[action].focus();
  };

  const readSettingsForm = (): BrowserSettings => {
    const bindings = {
      togglePause: elements.bindingInputs.togglePause.value,
      dismissTutorial: elements.bindingInputs.dismissTutorial.value,
      purchaseCurrentEncounter:
        elements.bindingInputs.purchaseCurrentEncounter.value,
      useCarriedItem: elements.bindingInputs.useCarriedItem.value,
    };
    const conflict = findBindingConflict(bindings);
    if (conflict !== null) {
      throw new TypeError(
        `${bindingLabel(conflict.code)} is assigned to multiple actions`,
      );
    }
    return normalizeSettings({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      bindings,
      sound: {
        muted: elements.soundMuted.checked,
        volume: elements.soundVolume.valueAsNumber,
      },
    });
  };

  const prepare = (): void => {
    const settings = options.readSettings();
    bindingCapture.replaceBindings(settings.bindings);
    render(settings);
    elements.bindingPrompt.textContent =
      "Choose Remap, then press a supported key. Press Escape to cancel.";
  };

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (bindingCapture.activeAction() === null) return false;
    if (event.repeat) {
      event.preventDefault();
      return true;
    }
    event.preventDefault();
    event.stopPropagation();
    options.onPrimeSound();
    handleBindingCaptureResult(bindingCapture.handleKeyDown(event.code));
    return true;
  };

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    options.onPrimeSound();
    let settings: BrowserSettings;
    try {
      settings = readSettingsForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus(
        message.includes("multiple actions")
          ? `Settings could not be saved. ${message}.`
          : "Settings could not be saved. Check each binding and the volume.",
        message.includes("multiple actions")
          ? "binding-conflict"
          : "invalid-record",
      );
      render(options.readSettings());
      presentUiAction("cancel");
      return;
    }

    const currentProfile = options.readProfile();
    const nextPreference = elements.tutorialPreference.checked
      ? "enabled"
      : "disabled";
    if (nextPreference !== currentProfile.tutorialPreference) {
      const latest = options.loadProfile();
      if (latest.status === "failed") {
        setStatus(
          `Tutorial preference could not be saved. Storage status: ${latest.error.code}`,
          latest.error.code,
        );
        render(options.readSettings());
        presentUiAction("cancel");
        return;
      }
      const profileSave = options.saveProfile({
        ...latest.profile,
        tutorialPreference: nextPreference,
      });
      if (profileSave.status !== "saved") {
        setStatus(
          `Tutorial preference could not be saved. Storage status: ${profileSave.error.code}`,
          profileSave.error.code,
        );
        render(options.readSettings());
        presentUiAction("cancel");
        return;
      }
      options.onProfileChanged(profileSave.profile);
    }

    const settingsSave = options.saveSettings(settings);
    if (settingsSave.status !== "saved") {
      setStatus(
        `Settings could not be saved. Storage status: ${settingsSave.error.code}`,
        settingsSave.error.code,
      );
      render(options.readSettings());
      presentUiAction("cancel");
      return;
    }
    options.onSettingsChanged(settingsSave.settings);
    bindingCapture.replaceBindings(settingsSave.settings.bindings);
    render(settingsSave.settings);
    renderKeyboardHints();
    elements.bindingPrompt.textContent =
      "Choose Remap, then press a supported key. Press Escape to cancel.";
    setStatus("Settings saved.");
    presentUiAction("confirm");
  });

  elements.titleTutorialToggle.addEventListener("change", () => {
    elements.tutorialPreference.checked = elements.titleTutorialToggle.checked;
    elements.form.requestSubmit();
  });

  elements.soundVolume.addEventListener("input", () => {
    const volume = Number(elements.soundVolume.value);
    elements.soundVolumeValue.value = `${Math.round(volume * 100)}%`;
    elements.soundVolumeValue.textContent = elements.soundVolumeValue.value;
  });

  elements.restoreDefaults.addEventListener("click", () => {
    const defaults = createDefaultSettings();
    render(defaults);
    bindingCapture.replaceBindings(defaults.bindings);
    elements.bindingPrompt.textContent =
      "Defaults restored in this form. Save settings to keep them.";
    setStatus("Defaults restored in this form. Save settings to keep them.");
    presentUiAction("confirm");
  });

  for (const button of elements.remapButtons) {
    button.addEventListener("click", () => {
      const action = button.dataset.remapAction;
      if (isInputAction(action)) {
        beginBindingCapture(action);
        presentUiAction("activate");
      }
    });
  }

  for (const input of Object.values(elements.bindingInputs)) {
    input.addEventListener("input", () => {
      bindingCapture.replaceBindings({
        togglePause: elements.bindingInputs.togglePause.value,
        dismissTutorial: elements.bindingInputs.dismissTutorial.value,
        purchaseCurrentEncounter:
          elements.bindingInputs.purchaseCurrentEncounter.value,
        useCarriedItem: elements.bindingInputs.useCarriedItem.value,
      });
      renderKeyboardHints();
    });
  }

  return Object.freeze({ render, prepare, setStatus, handleKeyDown });
}
