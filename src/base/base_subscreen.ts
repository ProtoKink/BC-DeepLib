import { BaseModule, BaseSettingsModel, GUI, advElement, domUtil, getText, layout, modules, modStorage, exportToGlobal } from '../deeplib';
import { SettingElement } from './elements_typings';

/** Optional configuration flags for a `BaseSubscreen` instance. */
export type SubscreenOptions = {
  /**
   * If `true`, the subscreen will draw the player's character model
   * in the UI when `run()` is called.
   * Also shift the UI to the right to make room for the character.
   */
  drawCharacter?: boolean;

  /**
   * Logical name of this subscreen.
   * Used for localization key resolution in `load()`.
   * Subclasses should override this with a meaningful identifier.
   */
  name: string;

  /**
   * Path to or Base64 data for an icon representing this subscreen.
   * Defaults to empty string (no icon).
   */
  icon?: string;

  /** 
   * An optional help button to open a subscreen or URL or run a function when clicked.
   */
  help?: {
    /** A URL or BaseSubscreen to open or a function to run when the help button is clicked  */
    onClick: URL | string | BaseSubscreen | (() => void);
    /** A tooltip to display when the help button is hovered over */
    tooltip?: string;
    /** An icon to display on the help button */
    icon?: string;
  },

  /** 
   * Screen to return to when exiting this subscreen. 
   * If not configured, the default is the main menu for all screens, but main menu itself.
   * For main menu, the default is the Extensions menu 
   */
  returnScreen?: (() => ScreenSpecifier | BaseSubscreen) | ScreenSpecifier | BaseSubscreen;

  /** 
   * The background image for this subscreen. 
   * Currently supports only images from the Club.
   */
  background?: string;

  /**
   * If `true`, the exit button will be shown on the subscreen.
   * Defaults to `true`.
   */
  doShowExitButton?: boolean;

  /**
   * If `true`, the title will be shown on the subscreen.
   * Defaults to `true`.
   */
  doShowTitle?: boolean;

  /** 
   * The width of the settings div in canvas pixels.
   * Defaults to 1000.
   */
  settingsWidth?: number;

  /**
   * If `true`, the character will be forced to the top of the screen.
   */
  forceUpCharacter?: boolean;
};

/**
 * Represents a constructor type for a subscreen.
 * Allows dynamic instantiation of subscreen classes with optional
 * configuration options and a parent module reference.
 */
export type Subscreen = new (
  module?: BaseModule
) => BaseSubscreen;

/** Switches the active subscreen in the global `GUI` instance. */
export async function setSubscreen(subscreen: BaseSubscreen | string) {
  if (!GUI.instance) {
    throw new Error('Attempt to set subscreen before init');
  }
  const screenName = typeof subscreen === 'string' ? subscreen : subscreen?.options.name;
  const screenId = `${BaseSubscreen.id}_${screenName}`;

  await CommonSetScreen(...['DeepLibMod', `${screenId}`] as unknown as ScreenSpecifier);
}

/**
 * Abstract base class for creating settings/configuration subscreens in a module.
 *
 * ### Responsibilities
 * This class defines the base contract for all modules in the system:
 *  - Provides a standardized interface for retrieving and storing settings
 *  - Ensures default settings are registered if missing
 *  - Integrates with the module storage system (`modStorage`)
 *  - Offers overridable lifecycle methods (`init`, `load`, `run`, `unload`)
 *
 * **Subclass Requirements:**
 *  - Must extend `BaseSubscreen`
 *  - Should override `name`, `icon` to define subscreen metadata
 *  - May override `pageStructure` to define UI layout and controls
 *  - May override lifecycle methods as needed
 */
export abstract class BaseSubscreen {
  /** Global registry of currently rendered elements and their definitions. */
  static currentElements: [HTMLElement, SettingElement][] = [];
  /** Tracks the currently visible page number (1-based index). */
  static currentPage: number = 1;
  /** Runtime options for this subscreen. */
  readonly options: SubscreenOptions;
  /** Reference to the module this subscreen belongs to. */
  readonly module!: BaseModule;
  /** Identifier for internal use to avoid screen name collisions. */
  static readonly id: string = CommonGenerateUniqueID();
  /** Optional configuration flags for a BaseSubscreen instance. */
  protected static readonly subscreenOptions: SubscreenOptions = {
    drawCharacter: true,
    name: 'UNKNOWN',
    icon: '',
    background: 'Sheet',
    doShowExitButton: true,
    doShowTitle: true,
    settingsWidth: 1000,
    forceUpCharacter: false
  };
  /** The menu at the top of the subscreen */
  protected static menu: HTMLDivElement | null = null;

  constructor(module?: BaseModule) {
    if (module) this.module = module;

    const ctor = this.constructor as typeof BaseSubscreen;
    this.options = {
      ...BaseSubscreen.subscreenOptions,
      ...ctor.subscreenOptions
    };

    const screenName = this.options.name;
    const screenId = `${BaseSubscreen.id}_${screenName}`;

    exportToGlobal(`${screenId}Load`, this.load.bind(this));
    exportToGlobal(`${screenId}Run`, this.run.bind(this));
    exportToGlobal(`${screenId}Click`, this.click.bind(this));
    exportToGlobal(`${screenId}Exit`, this.exit.bind(this));
    exportToGlobal(`${screenId}Unload`, this.unload.bind(this));
    exportToGlobal(`${screenId}Resize`, this.resize.bind(this));
    exportToGlobal(`${screenId}Background`, this.options.background);

    CommonCSVCache[ScreenFileGetTranslation('DeepLibMod', screenId) as string] = [];
  }

  /** Changes the currently active subscreen. */
  async setSubscreen(screen: BaseSubscreen | string) {
    return await setSubscreen(screen);
  }

  /** Gets this subscreen's settings object from its parent module. */
  get settings(): BaseSettingsModel {
    return this.module.settings as BaseSettingsModel;
  }

  /** Updates this subscreen's settings in its parent module. */
  set settings(value) {
    this.module.settings = value;
  }

  /**
   * Defines the paginated layout of the subscreen's settings UI.
   * Each element in the outer array is a page; each page contains `SettingElement`s.
   *
   * Subclasses should override to define their actual UI structure.
   */
  get pageStructure(): SettingElement[][] {
    return [[]];
  }

  /** Gets the currently visible page's settings elements. */
  get currentPage(): SettingElement[] {
    return this.pageStructure[Math.min(BaseSubscreen.currentPage - 1, this.pageStructure.length - 1)];
  }

  getPageLabel(): string {
    return getText('settings.page.label', {
      $currentPage$: BaseSubscreen.currentPage,
      $totalPages$: this.pageStructure.length,
    });
  }

  /**
   * Changes the visible page in a multi-page subscreen.
   * Automatically wraps around when going past the first or last page.
   */
  changePage(page: number, setLabel: (label: string) => void) {
    const totalPages = this.pageStructure.length;

    if (page > totalPages) page = 1;
    if (page < 1) page = totalPages;
    BaseSubscreen.currentPage = page;

    this.managePageElementsVisibility();

    setLabel(this.getPageLabel());
  }

  /**
   * Updates the DOM to show only elements belonging to the current page.
   * All elements on other pages are hidden.
   */
  managePageElementsVisibility() {
    this.pageStructure.forEach((item, ix) => {
      item.forEach((setting) => {
        const element = ElementWrap(`${setting.id}-container`) ?? ElementWrap(`${setting.id}`);

        if (ix !== BaseSubscreen.currentPage - 1) {
          if (element) domUtil.hide(element);
        } else {
          if (element) domUtil.unhide(element);
        }
      });
    });
  }

  /**
   * Called when this subscreen is first displayed.
   * Builds the layout, initializes navigation, and renders all settings elements.
   *
   * Handles:
   *  - Ensuring each module with a settings screen has its defaults loaded
   *  - Creating navigation menus and back/next page controls
   *  - Building and appending UI elements based on `pageStructure`
   *  - Setting up exit button and tooltip
   *  - Resetting to page 1
   */
  load() {
    for (const module of modules()) {
      if (!module.settingsScreen) continue;
      if (!module.settings || !Object.keys(module.settings).length) module.registerDefaultSettings(modStorage.playerStorage);
    }

    BaseSubscreen.currentPage = 1;

    layout.getSubscreen();
    const settingsElement = layout.getSettingsDiv();
    layout.appendToSubscreen(settingsElement);

    BaseSubscreen.menu = ElementMenu.Create('deeplib-nav-menu', []);
    layout.appendToSubscreen(BaseSubscreen.menu);

    if (this.pageStructure.length > 1) {
      const backNext = advElement.createBackNext({
        id: 'deeplib-page-back-next',
        next: ({ setLabel }) => this.changePage(BaseSubscreen.currentPage + 1, setLabel),
        initialNextTooltip: getText('settings.button.next_button_hint'),
        back: ({ setLabel }) => this.changePage(BaseSubscreen.currentPage - 1, setLabel),
        initialPrevTooltip: getText('settings.button.prev_button_hint'),
        initialLabel: this.getPageLabel()
      });

      BaseSubscreen.menu.prepend(backNext);
    }

    if (this.options.help) {
      const onClick = this.options.help.onClick;
      let action = () => { };
      if (typeof onClick === 'string' || onClick instanceof URL) {
        action = () => window.open(onClick, '_blank');
      } else if (typeof onClick === 'function') {
        action = onClick;
      } else if (onClick instanceof BaseSubscreen) {
        action = async () => await this.setSubscreen(onClick);
      }

      this.options.help.tooltip ??= getText('settings.button.help_button_hint');
      this.options.help.icon ??= `${PUBLIC_URL}/dl_images/bookmark.svg`;

      const helpButton = advElement.createButton({
        id: 'deeplib-help',
        size: [90, 90],
        onClick: action,
        options: {
          image: this.options.help.icon,
          tooltip: this.options.help.tooltip
        }
      });

      BaseSubscreen.menu.append(helpButton);
    }

    if (this.options.doShowTitle) {
      const subscreenTitle = advElement.createLabel({
        id: 'deeplib-subscreen-title',
        label: getText(`${this.options.name}.title`, { 
          '$ModVersion': MOD_VERSION_CAPTION 
        }),
      });
      layout.appendToSubscreen(subscreenTitle);
    }

    if (this.options.doShowExitButton) {
      const exitButton = advElement.createButton({
        id: 'deeplib-exit',
        size: [90, 90],
        onClick: () => {
          this.exit();
        },
        options: {
          image: `${PUBLIC_URL}/dl_images/exit.svg`,
          tooltip: getText('settings.button.back_button_hint')
        }
      });
      BaseSubscreen.menu.append(exitButton);
    }

    const tooltip = advElement.createTooltip();
    layout.appendToSubscreen(tooltip);

    this.pageStructure.forEach((s) =>
      s.forEach((item) => {
        let element: HTMLElement;
        switch (item.type) {
          case 'text':
          case 'number':
          case 'color':
            element = advElement.createInput(item);
            break;
          case 'checkbox':
            element = advElement.createCheckbox(item);
            break;
          case 'button':
            element = advElement.createButton(item);
            break;
          case 'label':
            element = advElement.createLabel(item);
            break;
          case 'custom':
            element = advElement.createCustom(item);
            break;
          case 'dropdown':
            element = advElement.createDropdown(item);
            break;
        }
        layout.appendToSettingsDiv(element);
      })
    );

    this.managePageElementsVisibility();

    if (this.options.drawCharacter && this.options.forceUpCharacter) {
      CharacterAppearanceForceUpCharacter = Player.MemberNumber;
    } else {
      CharacterAppearanceForceUpCharacter = -1;
    }
  }


  /**
   * Called each frame while this subscreen is active.
   * Default behavior draws the player's character if `drawCharacter` is enabled.
   */
  run() {
    if (this.options.drawCharacter) DrawCharacter(Player, 50, 50, 0.9, false);
  }

  /**
   * Handles mouse clicks *on canvas* while the subscreen is active.
   * Default implementation is empty — subclasses may override.
   */
  click() {
  }

  /**
   * Exits this subscreen, returning to the main menu.
   * Also saves persistent storage changes.
   * Called after the `unload`.
   */
  exit() {
    CharacterAppearanceForceUpCharacter = -1;
    CharacterLoadCanvas(Player);

    const returnScreen = typeof this.options.returnScreen === 'function' ? this.options.returnScreen() : this.options.returnScreen;

    if (returnScreen instanceof BaseSubscreen || !returnScreen) {
      setSubscreen(returnScreen ?? 'mainmenu').then(() => {
        modStorage.save();
      });
    } else if (Array.isArray(returnScreen)) {
      CommonSetScreen(...returnScreen).then(() => {
        modStorage.save();
      });
    }
  }

  /**
   * Called when the window is resized.
   * Also checks for overflow in the settings div and applies styling accordingly.
   */
  resize(_onLoad: boolean = false) {
    const offset = this.options.drawCharacter ? 0 : 380;
    const subscreen = layout.getSubscreen();
    const settingsDiv = layout.getSettingsDiv();

    ElementSetPosition(subscreen, 0, 0);
    ElementSetSize(subscreen, 2000, 1000);
    ElementSetFontSize(subscreen, 'auto');

    ElementSetPosition(settingsDiv, 530 - offset, 170);
    ElementSetSize(settingsDiv, this.options.settingsWidth ?? 1000 + offset, 660);

    if (this.options.doShowTitle) {
      ElementSetPosition('deeplib-subscreen-title', 530 - offset, 75);
      ElementSetSize('deeplib-subscreen-title', 800, 90);
    }

    ElementSetPosition('deeplib-nav-menu', 1905, 75, 'top-right');
    ElementSetSize('deeplib-nav-menu', null, 90);

    ElementSetSize(advElement.getTooltip() || '', 1500);

    BaseSubscreen.currentElements.forEach((item) => {
      const element = item[0];
      const options = item[1];

      domUtil.autoSetPosition(options.id ?? element.id, options.position);
      domUtil.autoSetSize(options.id ?? element.id, options.size);
    });

    if (settingsDiv) {
      if (domUtil.hasOverflow(settingsDiv)?.vertical) {
        settingsDiv.classList.add('deeplib-overflow-box');
      } else {
        settingsDiv.classList.remove('deeplib-overflow-box');
      }
    }
  }


  /**
   * Called when this subscreen is being removed.
   * Resets the static element registry and removes the subscreen from the layout.
   * Called before `exit`.
   */
  unload() {
    BaseSubscreen.currentElements = [];

    layout.removeSubscreen();
  }
}

