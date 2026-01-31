
import { BaseModule, BaseSettingsModel, BaseSubscreen, ModuleKey, SubscreenOptions, deepMerge, getModule, getText, hasGetter, layout, modLogger, modules } from '../deeplib';
import { advElement } from '../utilities/elements/elements';
import { Modal } from '../utilities/elements/modal';

/**
 * Configuration options for the {@link GuiImportExport} class.
 */
export type ImportExportOptions = {
  /** 
   * A custom save file extension (e.g., ".mydata"). 
   * If it doesn't start with a dot, it will be automatically prefixed.
   */
  customFileExtension: string;

  /** Optional callback invoked after data has been successfully imported. */
  onImport?: () => void;

  /** Optional callback invoked after data has been successfully exported. */
  onExport?: () => void;
};

/**
 * Possible data transfer methods for import/export operations.
 * - `clipboard`: Uses the system clipboard.
 * - `file`: Uses file save/load dialogs.
 */
type DataTransferMethod = 'clipboard' | 'file';

type DataTransferDirection = 'import' | 'export';

/**
 * GUI screen for importing and exporting mod data.
 * Provides buttons to import/export data either via file or clipboard.
 */
export class GuiImportExport extends BaseSubscreen {
  private importExportOptions: ImportExportOptions;

  static override subscreenOptions: SubscreenOptions = {
    name: 'import-export',
  };

  constructor(importExportOptions: ImportExportOptions) {
    super();
    this.importExportOptions = importExportOptions;
  }

  load(): void {

    super.load();

    const importFromFileButton = advElement.createButton({
      id: 'deeplib-import-file-button',
      size: [600, 90],
      onClick: () => {
        this.dataImport('file');
      },
      options: {
        image: `${PUBLIC_URL}/dl_images/file_import.svg`,
        label: getText('import-export.button.import_file')
      }
    });
    layout.appendToSettingsDiv(importFromFileButton);

    const exportToFileButton = advElement.createButton({
      id: 'deeplib-export-file-button',
      size: [600, 90],
      onClick: () => {
        this.dataExport('file');
      },
      options: {
        image: `${PUBLIC_URL}/dl_images/file_export.svg`,
        label: getText('import-export.button.export_file')
      }
    });
    layout.appendToSettingsDiv(exportToFileButton);

    const importFromClipboardButton = advElement.createButton({
      id: 'deeplib-import-clipboard-button',
      size: [600, 90],
      onClick: () => {
        this.dataImport('clipboard');
      },
      options: {
        image: `${PUBLIC_URL}/dl_images/clipboard_import.svg`,
        label: getText('import-export.button.import_clipboard')
      }
    });
    layout.appendToSettingsDiv(importFromClipboardButton);

    const exportToClipboardButton = advElement.createButton({
      id: 'deeplib-export-clipboard-button',
      size: [600, 90],
      onClick: () => {
        this.dataExport('clipboard');
      },
      options: {
        image: `${PUBLIC_URL}/dl_images/clipboard_export.svg`,
        label: getText('import-export.button.export_clipboard')
      }
    });
    layout.appendToSettingsDiv(exportToClipboardButton);
  }

  resize(): void {
    super.resize();
  }

  /** Exports the mod data using the specified method. */
  async dataExport(transferMethod: DataTransferMethod) {
    try {
      const selected = await this.getSelectedModules(modules(), 'export');

      if (!selected) return;

      if (selected.length === 0) {
        ToastManager.error('No modules selected for export.');
        return;
      }

      const data = this.buildExportPayload(selected);

      if (transferMethod === 'clipboard') {
        await this.exportToClipboard(data);
      } else if (transferMethod === 'file') {
        if (!await this.exportToFile(data, 'settings')) {
          return;
        };
      }

      this.importExportOptions.onExport?.();
      ToastManager.success('Data exported successfully.');
    } catch (error) {
      ToastManager.error('Data export failed.');
      modLogger.error('Data export failed.', error,);
    }
  }

  /** Imports mod data using the specified method. */
  async dataImport(transferMethod: DataTransferMethod) {
    try {
      const raw =
        transferMethod === 'clipboard'
          ? await this.importFromClipboard()
          : await this.importFromFile();

      if (raw === null) return;

      if (!raw) throw new Error('No data');

      const importResult = await this.applyImportPayload(raw);

      if (!importResult) return;

      this.importExportOptions.onImport?.();
      ToastManager.success('Data imported successfully.');
    } catch (error) {
      ToastManager.error('Data import failed.');
      modLogger.error('Data import failed.', error,);
    }
  }

  /** Saves data to a file using the browser's save dialog. */
  async exportToFile(data: string, defaultFileName: string): Promise<boolean> {
    const CUSTOM_EXTENSION = this.importExportOptions.customFileExtension.startsWith('.')
      ? this.importExportOptions.customFileExtension
      : '.' + this.importExportOptions.customFileExtension;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFileName + CUSTOM_EXTENSION,
          types: [
            {
              description: 'Custom Data Files',
              accept: { 'text/plain': [CUSTOM_EXTENSION] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();

        return true;
      } catch (error: any) {
        throw new Error('File save cancelled or failed: ' + error.message);
      }
    } else {
      const fileName = await Modal.prompt('Enter file name', { defaultValue: defaultFileName });

      if (fileName === null) {
        return false;
      } else if (fileName === '') {
        throw new Error('File name cannot be empty.');
      }

      const blob = new Blob([data], { type: 'text/plain' });
      const link = ElementCreate({
        tag: 'a',
        attributes: {
          href: URL.createObjectURL(blob),
          download: fileName + CUSTOM_EXTENSION
        },
      });

      link.click();
      URL.revokeObjectURL(link.href);

      return true;
    }
  }

  /** Opens a file picker and reads the selected file's contents, importing the data. */
  async importFromFile(): Promise<string | null> {
    const CUSTOM_EXTENSION = this.importExportOptions.customFileExtension.startsWith('.')
      ? this.importExportOptions.customFileExtension
      : '.' + this.importExportOptions.customFileExtension;

    async function importFromFileInternal(file: File): Promise<string | null> {
      if (!file.name.endsWith(CUSTOM_EXTENSION)) {
        throw new Error(`Invalid file type. Expected a ${CUSTOM_EXTENSION} file.`);
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
      });
    }

    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Custom Data Files',
              accept: { 'text/plain': [CUSTOM_EXTENSION] },
            },
          ],
          multiple: false,
        });
        const file = await fileHandle.getFile();
        return await importFromFileInternal(file);
      } catch (error: any) {
        throw new Error('File selection cancelled or failed: ' + error.message);
      }
    } else {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = CUSTOM_EXTENSION;
        input.onchange = async (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            try {
              const data = await importFromFileInternal(file);
              resolve(data);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('No file selected.'));
          }
        };
        input.click();
      });
    }
  }

  /** Copies the given data to the clipboard. */
  async exportToClipboard(data: string): Promise<void> {
    return navigator.clipboard.writeText(data).catch((error) => {
      throw new Error('Failed to copy data to clipboard.' + error);
    });
  }

  /** Prompts the user to enter data and returns it. */
  async importFromClipboard(): Promise<string | null> {
    return Modal.prompt('Enter data to import').catch((error) => {
      throw new Error('Failed to read data from clipboard.' + error);
    });
  }

  private async getSelectedModules(modulesToChoose: BaseModule[], transferDirection: DataTransferDirection): Promise<BaseModule[] | null> {
    const modulesFiltered = modulesToChoose.filter(m => hasGetter(m, 'settings') && !!m.settings);
    const checkedModules: Record<string, boolean> = Object.fromEntries(
      modulesFiltered.map(m => [m.constructor.name, true])
    );

    if (modulesFiltered.length === 0) {
      throw new Error('No modules to choose from.');
    }

    const checkboxes = modulesFiltered
      .map(m => advElement.createCheckbox({
        id: m.constructor.name,
        label: getText(m.constructor.name),
        setElementValue: () => checkedModules[m.constructor.name],
        setSettingValue: (val: boolean) => checkedModules[m.constructor.name] = val
      }));
    const text = transferDirection === 'import' ?
      'import_export.import.select_modules' :
      'import_export.export.select_modules';

    const response = await Modal.confirm([
      getText(text),
      ElementCreate({ tag: 'br' }),
      getText('import_export.text.not_sure'),
      {
        tag: 'div',
        classList: ['deeplib-modal-checkbox-container'],
        children: checkboxes
      }
    ], { modalId: 'deeplib-modal-import_export' });

    if (!response) {
      return null;
    }

    const ret = Object.entries(checkedModules)
      .filter(([_, checked]) => checked)
      .map(([id]) => getModule(id as ModuleKey))
      .filter(m => !!m);

    if (ret.length === 0) {
      throw new Error('No modules selected.');
    }

    return ret;
  }

  private buildExportPayload(selectedModules: BaseModule[]): string {
    const payload: Record<string, BaseSettingsModel> = {};

    for (const module of selectedModules) {
      if (!hasGetter(module, 'settings') || module.settings === null) continue;

      payload[module.constructor.name] = module.settings;
    }

    return LZString.compressToBase64(JSON.stringify(payload));
  }

  private async applyImportPayload(raw: string): Promise<void | boolean> {
    const decoded = JSON.parse(
      LZString.decompressFromBase64(raw) ?? ''
    ) as Record<string, BaseSettingsModel>;

    if (!decoded) {
      throw new Error('Invalid import format.');
    }

    const modules = Object.keys(decoded).map(id => getModule(id as ModuleKey)).filter(m => !!m);
    const selectedModules = await this.getSelectedModules(modules, 'import');

    if (!selectedModules) {
      return false;
    }

    if (selectedModules.length === 0) {
      throw new Error('No modules selected.');
    }

    for (const module of selectedModules) {
      const data = decoded[module.constructor.name];
      if (!data) continue;

      const merged = deepMerge(module.defaultSettings, data);

      if (!merged) continue;

      module.settings = merged;
    }

    return true;
  }
}
