import { BaseSettingsModel, SettingsModel, Subscreen, modStorage, deepMerge } from '../deeplib';

/**
 * An abstract foundation for modular systems that require:
 *  - Optional settings screens
 *  - Persistent settings storage per module
 *  - Default settings registration
 *  - Lifecycle hooks for loading, running, and unloading
 *
 * ### Responsibilities
 * This class defines the base contract for all modules in the system:
 *  - Provides a standardized interface for retrieving and storing settings
 *  - Ensures default settings are registered if missing
 *  - Integrates with the module storage system (`modStorage`)
 *  - Offers overridable lifecycle methods (`init`, `load`, `run`, `unload`)
 *
 * **Subclass Requirements:**
 *  - Must extend `BaseModule`
 *  - Should override `defaultSettings` to define defaults for its settings, if any
 *  - May override `settingsScreen` to provide a UI component
 *  - May override lifecycle methods as needed
 */
export abstract class BaseModule {
  /**
   * An optional UI screen for configuring this module's settings.
   * Subclasses can override this getter to provide a `Subscreen` instance.
   * Modules with screens are automatically registered to the main menu.
   */
  get settingsScreen(): Subscreen | null {
    return null;
  }

  /**
   * The storage key under which this module's settings will be saved.
   * Defaults to the class name.
   *
   * Subclasses can override this if they require a custom storage key.
   */
  get settingsStorage(): string | null {
    return this.constructor.name;
  }

  /**
   * Retrieves the current settings for this module.
   * If no settings exist yet, registers default settings first.
   */
  get settings(): BaseSettingsModel | null {
    if (!this.settingsStorage) return null;
    if (!modStorage.playerStorage) {
      this.registerDefaultSettings(modStorage.playerStorage);
    } else if (!modStorage.playerStorage[this.settingsStorage]) {
      this.registerDefaultSettings(modStorage.playerStorage);
    }

    return modStorage.playerStorage[this.settingsStorage] as BaseSettingsModel | null;
  }

  /**
   * Persists new settings for this module.
   * Automatically initializes storage and defaults if they don't exist.
   */
  set settings(value) {
    if (!this.settingsStorage) return;
    if (!modStorage.playerStorage) {
      this.registerDefaultSettings(modStorage.playerStorage);
    } else if (!modStorage.playerStorage[this.settingsStorage]) {
      this.registerDefaultSettings(modStorage.playerStorage);
    }

    modStorage.playerStorage[this.settingsStorage] = value;
  }

  /**
   * Initializes the module.
   * Subclasses can override to perform additional setup.
   */
  init() {
  }

  /**
   * Registers default settings for this module in persistent storage.
   * Only runs if a storage key and default settings are defined.
   * 
   * If some settings already exist, they will be merged with defaults.
   * Existing values will NOT be overwritten.
   */
  registerDefaultSettings(target: SettingsModel): void {
    const storage = this.settingsStorage;
    const defaults = this.defaultSettings;
    if (!storage || !defaults) return;
    if (Object.entries(this.defaultSettings).length === 0) return;

    target[storage] = deepMerge(this.defaultSettings, target[storage], { concatArrays: false, matchingOnly: true });
  }

  /**
   * Provides default settings for this module.
   * Subclasses should override this getter to return their defaults.
   */
  get defaultSettings(): BaseSettingsModel | null {
    return null;
  }

  /**
   * Called when the module is loaded into the system.
   * Subclasses should override to perform data loading or initialization.
   */
  load() { }

  /**
   * By default doesn't get called each frame, only once when the module is loaded.
   * Subclasses can override to implement runtime logic.
   */
  run() { }

  /**
   * Called when the module is being removed.
   * Subclasses can override to perform cleanup or save final state.
   */
  unload() { }
}
