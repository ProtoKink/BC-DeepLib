import deeplib_style from '../styles/index.scss';
import { ModSdkManager, Localization, modules, registerModule, Style, ModStorage, MainMenuOptions, MainMenu, TranslationOptions, Logger, VersionModule, ModuleKey, tryCatch, ModulesList, getModule, tryCatchAsync } from '../deeplib';
import { DebugModule } from '../modules/debug';

/** Configuration object for initializing a mod via `initMod`. */
interface InitOptions {
  /**
   * Name of the mod.
   * Used to identify the mod in the Mod SDK and storage.
   */
  modName: string,

  /**
   * Repository URL for the mod.
   * Used to register the mod with the Mod SDK and display in the main menu.
   */
  modRepository?: string,

  /**
   * List of modules (`BaseModule` subclasses) to register with the mod system.
   * Modules are initialized, loaded, and run in order.
   */
  modules?: Partial<ModulesList>;

  /** 
   * Configuration for customizing the main menu when the mod is active.
   * Does nothing if GUI module is not loaded. 
   */
  mainMenuOptions?: Prettify<Omit<MainMenuOptions, 'repoLink'>>;

  /**
   * Optional hook executed *before* login when the player is not yet authenticated.
   * Useful for pre-login setup or display changes.
   */
  beforeLogin?: () => (void);

  /**
   * Optional async/sync function run after modules and translations are initialized.
   * Can be used to perform additional setup tasks.
   */
  initFunction?: () => (void | Promise<void>);

  /** Options for initializing the localization/translation system. */
  translationOptions?: TranslationOptions;
}

/**
 * Global storage handler for mod.
 * Initialized by `initMod()` and mod data loaded by `init()`.
 */
export let modStorage: ModStorage;

/**
 * Global Mod SDK manager.
 * Initialized by `initMod()`.
 */
export let sdk: ModSdkManager;

/**
 * Mod specific logger instance.
 * Initialized by `initMod()`.
 */
export let modLogger: Logger;

export let MOD_NAME: string;

/**
 * Entry point for initializing a mod. Handles:
 *  - Setting up the Mod SDK
 *  - Preparing persistent storage
 *  - Injecting required styles
 *  - Delaying initialization until login (if necessary)
 */
export async function initMod(options: InitOptions) {
  const url = 'https://cdn.jsdelivr.net/npm/bondage-club-mod-sdk@1.2.0/+esm';

  if (!(window as any).bcModSdk) {
    await import(`${url}`);
  }

  sdk = new ModSdkManager({
    name: options.modName,
    fullName: options.modName,
    version: MOD_VERSION,
    repository: options.modRepository
  });
  MOD_NAME = options.modName;

  modStorage = new ModStorage(options.modName);
  modLogger = new Logger(MOD_NAME);
  Style.injectInline(`deeplib-style-${DEEPLIB_VERSION}`, deeplib_style);

  modLogger.debug('Init wait');
  if (!CurrentScreen || CurrentScreen === 'Login') {
    options.beforeLogin?.();
  }

  await ServerIsLoggedInAsync();
  init(options);
}


/**
 * Fully initializes the mod after login.
 * Handles:
 *  - Preventing double-load
 *  - Loading mod data
 *  - Initializing localization
 *  - Registering modules and migrators
 *  - Running optional init functions
 *  - Applying main menu changes
 *  - Merging default settings into module settings
 *
 * @param {InitOptions} options Configuration for mod initialization.
 */
async function init(options: InitOptions) {
  if ((window as any)[options.modName + 'Loaded']) return;

  const storageRes = tryCatch(() => {
    modStorage.load();
  }, e => e as Error);
  if (!storageRes.ok) {
    modLogger.error(storageRes.error);
  }

  const localizationRes = await tryCatchAsync(async () => {
    await Localization.init(options.translationOptions);
  }, e => e as Error);
  if (!localizationRes.ok) {
    modLogger.error(localizationRes.error);
  }

  const optionModules = Object.entries(options.modules ?? {}) as [ModuleKey, ModulesList[ModuleKey]][];
  const modulesToRegister: [ModuleKey, ModulesList[ModuleKey]][] = [];

  if (!optionModules.some(m => m[1] instanceof VersionModule)) {
    modulesToRegister.push(['VersionModule', new VersionModule()]);
  }

  if (IS_DEBUG && !optionModules.some(m => m[1] instanceof DebugModule)) {
    modulesToRegister.push(['DebugModule', new DebugModule()]);
  }

  modulesToRegister.push(...optionModules);

  if (!initModules(modulesToRegister)) {
    unloadMod();
    return;
  }

  await options.initFunction?.();

  if (options.mainMenuOptions && getModule('GUI')) {
    MainMenu.setOptions({
      ...options.mainMenuOptions,
      repoLink: options.modRepository,
    });
  }

  (window as any)[options.modName + 'Loaded'] = true;
  modLogger.log(`Loaded! Version: ${MOD_VERSION_CAPTION}`);
}


/**
 * Registers and starts all modules.
 * Runs `init()`, `load()`, and `run()` for each module in order.
 */
function initModules(modulesToRegister: [ModuleKey, ModulesList[ModuleKey]][]): boolean {
  for (const [moduleKey, module] of modulesToRegister) {
    registerModule(moduleKey, module);
  }

  for (const module of modules()) {
    const res = tryCatch(() => module.init(), e => e as Error);
    if (!res.ok) {
      modLogger.error(res.error);
    }
  }

  for (const module of modules()) {
    const res = tryCatch(() => module.load(), e => e as Error);
    if (!res.ok) {
      modLogger.error(res.error);
    }
  }

  for (const module of modules()) {
    const res = tryCatch(() => module.run(), e => e as Error);
    if (!res.ok) {
      modLogger.error(res.error);
    }
  }

  // Running after `.load` because the version modules runs migrations.
  // If this will run before `.load` some data used in migration might be overwriten.
  for (const module of modules()) {
    module.registerDefaultSettings(modStorage.playerStorage);
  }

  modLogger.debug('Modules Loaded.');
  return true;
}

/** 
 * Cleans up and removes the mod from memory.
 * Calls `unload()` on all modules and removes the global loaded flag.
 */
export function unloadMod(): true {
  unloadModules();
  sdk.unload();

  delete (window as any)[MOD_NAME + 'Loaded'];
  modLogger.debug('Unloaded.');
  return true;
}

/** Calls the `unload()` lifecycle method on all registered modules. */
function unloadModules() {
  for (const module of modules()) {
    module.unload();
  }
}
