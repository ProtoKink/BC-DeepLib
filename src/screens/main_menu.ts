
import { BaseSubscreen, byteToKB, getModule, getText, GUI, GuiDebug, layout, modStorage, setSubscreen, SubscreenOptions } from '../deeplib';
import { advElement } from '../utilities/elements/elements';
import { GuiImportExport } from './import_export';

/**
 * Configuration options for the main menu.
 * 
 * If these are defined, new button for each option will be added to the main menu.
 */
export type MainMenuOptions = {
  /**
   * Optional URL to the project's repository.
   * Example: "https://github.com/user/project"
   */
  repoLink?: string;

  /**
   * Optional URL to the project's wiki or documentation.
   * Example: "https://github.com/user/project/wiki"
   */
  wikiLink?: string;

  /**
   * Optional subscreen to use for the "reset" action.
   */
  resetSubscreen?: BaseSubscreen;

  /**
   * Optional subscreen for import/export functionality.
   * Provides tools to import or export data to or from the mod.
   */
  importExportSubscreen?: GuiImportExport;

  /**
   * Optional boolean flag to enable the mod storage fullness indicator.
   */
  storageFullnessIndicator?: boolean;
};

export class MainMenu extends BaseSubscreen {
  subscreens: BaseSubscreen[] = [];

  private static options: MainMenuOptions = {};

  protected static override subscreenOptions: SubscreenOptions = {
    name: 'mainmenu',
    doShowExitButton: false,
    settingsWidth: 600
  };

  constructor(module: GUI) {
    super(module);

    this.subscreens = module.subscreens;
  }

  load(): void {
    if (!GUI.instance || CurrentModule as string !== 'DeepLibMod') {
      this.setSubscreen(this);
      return;
    }

    super.load();

    const exitButton = advElement.createButton({
      id: 'exit',
      size: [90, 90],
      onClick: () => {
        this.exit();
      },
      options: {
        image: `${PUBLIC_URL}/dl_images/exit.svg`,
        tooltip: getText('settings.button.back_button_hint')
      }
    });

    const menu = document.getElementById('deeplib-nav-menu');
    if (menu) {
      menu.append(exitButton);
    }

    for (const screen of this.subscreens) {

      if (screen.options.name === 'mainmenu') continue;

      const button = advElement.createButton({
        id: `${screen.options.name}-button`,
        onClick: () => {
          this.setSubscreen(screen);
        },
        size: [null, 90],
        options: {
          image: screen.options.icon,
          label: getText(`mainmenu.button.${screen.options.name}`),
        }
      });

      layout.appendToSettingsDiv(button);
    }

    const miscDiv = layout.getMiscDiv();
    layout.appendToSubscreen(miscDiv);

    if (MainMenu.options.wikiLink) {
      const wikiButton = advElement.createButton({
        id: 'deeplib-wiki-button',
        onClick: () => {
          window.open(MainMenu.options.wikiLink, '_blank');
        },
        size: [null, 80],
        options: {
          image: `${PUBLIC_URL}/dl_images/notebook.svg`,
          label: getText('mainmenu.button.wiki'),
        }
      });
      layout.appendToMiscDiv(wikiButton);
    }

    if (MainMenu.options.repoLink) {
      const repoButton = advElement.createButton({
        id: 'deeplib-repo-button',
        onClick: () => {
          window.open(MainMenu.options.repoLink, '_blank');
        },
        size: [null, 80],
        options: {
          image: `${PUBLIC_URL}/dl_images/git.svg`,
          label: getText('mainmenu.button.repo'),
        }
      });
      layout.appendToMiscDiv(repoButton);
    }

    if (MainMenu.options.resetSubscreen) {
      const resetButton = advElement.createButton({
        id: 'deeplib-reset-button',
        onClick: () => {
          this.setSubscreen(MainMenu.options.resetSubscreen!);
        },
        size: [null, 80],
        options: {
          image: `${PUBLIC_URL}/dl_images/trash_bin.svg`,
          label: getText('mainmenu.button.reset'),
        }
      });
      layout.appendToMiscDiv(resetButton);
    }

    if (MainMenu.options.importExportSubscreen) {
      const importExportButton = advElement.createButton({
        id: 'deeplib-import-export-button',
        onClick: () => {
          this.setSubscreen(MainMenu.options.importExportSubscreen!);
        },
        size: [null, 80],
        options: {
          image: `${PUBLIC_URL}/dl_images/transfer.svg`,
          label: getText('mainmenu.button.import_export'),
        }
      });
      layout.appendToMiscDiv(importExportButton);
    }

    if (MainMenu.options.storageFullnessIndicator) {
      const maxStorageCapacityKB = 180;
      const currentStorageCapacityKB = byteToKB(modStorage.storageSize());
      const fullness = (currentStorageCapacityKB / maxStorageCapacityKB * 100).toFixed(1);

      const storageFullnessWrapper = advElement.createButton({
        id: CommonGenerateUniqueID(),
        size: [null, 80],
        options: {
          tooltipPosition: 'left',
          noStyling: true,
          tooltip: CommonStringPartitionReplace(getText('mainmenu.meter.storage_hint'), {
            $percentage$: `${fullness}`
          }).join(''),
          label: CommonStringPartitionReplace(getText('mainmenu.meter.storage_label'), {
            $currentCapacity$: `${currentStorageCapacityKB}`,
            $maxCapacity$: `${maxStorageCapacityKB}`,
          }).join(''),
        },
        htmlOptions: {
          button: {
            children: [
              {
                tag: 'div',
                attributes: { id: 'deeplib-storage-meter' },
                children: [
                  {
                    tag: 'div',
                    attributes: { id: 'deeplib-storage-bar' },
                    style: { width: `${fullness}%` },
                  },
                ]
              }
            ]
          }
        }
      });
      layout.appendToMiscDiv(storageFullnessWrapper);
    }

    if (IS_DEBUG) {
      const debugButton = advElement.createButton({
        id: 'deeplib-debug-button',
        onClick: () => {
          this.setSubscreen(new GuiDebug(getModule('DebugModule')));
        },
        size: [90, 90],
        options: {
          image: `${PUBLIC_URL}/dl_images/bug.svg`,
        }
      });
      if (menu) {
        menu.prepend(debugButton);
      }
    }
  }

  run() {
    super.run();
  }

  click() { }

  exit(): void {
    CharacterAppearanceForceUpCharacter = -1;
    CharacterLoadCanvas(Player);

    const returnScreen = typeof this.options.returnScreen === 'function' ? this.options.returnScreen() : this.options.returnScreen;

    if (!returnScreen) {
      PreferenceOpenSubscreen('Extensions').then(() => {
        PreferenceSubscreenExtensionsClear();
      });
    } else if (returnScreen instanceof BaseSubscreen) {
      setSubscreen(returnScreen).then(() => {
      });
    } else if (Array.isArray(returnScreen)) {
      CommonSetScreen(...returnScreen);
    }
  }

  resize(): void {
    super.resize();
    ElementSetPosition('deeplib-misc', 1905, 930, 'bottom-right');
    ElementSetSize('deeplib-misc', 405, null);
  }

  static setOptions(mainMenuOptions: MainMenuOptions) {
    MainMenu.options = mainMenuOptions;
  }
}