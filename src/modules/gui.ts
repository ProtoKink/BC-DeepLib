import { BaseModule, BaseSubscreen, MainMenu, modules, setSubscreen } from '../deeplib';

/** Options for configuring a mod's main button in the extensions menu. */
type GuiOptions = {

  /**
   * Unique identifier for the mod's settings button.
   * Used internally by the preference system to track the button.
   */
  identifier: string;

  /**
   * The label displayed on the settings button.
   * Can be a string or a function that returns a string dynamically.
   */
  buttonText: Thunk<string>;

  /** 
   * The path to or Base64 data of the icon for the settings button.
   * Can be a string or a function that returns a string dynamically.
   */
  image: Thunk<string>;
  
  /**
   * The main menu screen for the mod.
   */
  mainMenu?: typeof MainMenu;
};

/**
 * Central mod GUI controller that manages all subscreens.
 *
 * This module is responsible for:
 * - Registering the mod's settings button in the game's preferences.
 * - Managing subscreens (including settings screens for all registered modules).
 * - Routing lifecycle events (load, run, click, exit, unload) to the active subscreen.
 */
export class GUI extends BaseModule {
  /** The singleton instance of the GUI controller. */
  static instance: GUI | null = null;

  /** All subscreens managed by this GUI, including the main menu and module settings screens. */
  private _subscreens: BaseSubscreen[] = [];
  /** The mod's main menu screen. */
  private _mainMenu: MainMenu | null = null;
  /** Options defining how the mod's settings button is displayed and behaves. */
  private _modButtonOptions: GuiOptions | null;

  /** Returns all registered subscreens. */
  get subscreens(): BaseSubscreen[] {
    return this._subscreens;
  }

  /** Returns the main menu subscreen instance. */
  get mainMenu(): MainMenu | null {
    return this._mainMenu;
  }

  /** 
   * Creates the GUI instance and initializes the main menu. 
   * 
   * @throws If another `GUI` instance already exists.
   */
  constructor(guiOptions: GuiOptions | null = null) {
    super();
    if (GUI.instance) {
      throw new Error('Duplicate initialization');
    }

    for (const module of modules()) {
      if (!module.settingsScreen) continue;
    }

    this._modButtonOptions = guiOptions;

    GUI.instance = this;
  }

  /**
   * Loads the GUI and registers the mod's settings button in the extensions menu.
   *
   * - Creates subscreens for each module's settings screen.
   * - Registers lifecycle callbacks for subscreens events.
   * - Sets up the main menu and its subscreens.
   */
  load(): void {
    if (!this._modButtonOptions) return;

    const guiOptions = this._modButtonOptions;
    this._mainMenu = guiOptions?.mainMenu ? new guiOptions.mainMenu(this) : new MainMenu(this);
    this._subscreens = [this._mainMenu];
    
    for (const module of modules()) {
      if (!module.settingsScreen) continue;

      this._subscreens.push(new module.settingsScreen(module));
    }

    this._mainMenu.subscreens = this._subscreens;

    PreferenceRegisterExtensionSetting({
      Identifier: this._modButtonOptions.identifier,
      ButtonText: this._modButtonOptions.buttonText,
      Image: this._modButtonOptions.image,
      load: async () => {
        if (!this._mainMenu) return;
        await setSubscreen(this._mainMenu);
      },
      run: () => {},
      click: () => {},
      exit: () => {},
    });
  }
}
