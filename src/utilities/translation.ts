/**
 * A dictionary type representing translations,
 * where keys are source tags and values are translated strings.
 */
type TranslationDict = {
  [key: string]: string;
};

/**
 * Options for initializing the Localization system.
 */
export interface TranslationOptions {
  /** The path to the folder where the translations are stored. */
  pathToTranslationsFolder?: string;
  /** The default language to use. */
  defaultLanguage?: string;
  /** If true, the localization will be fixed to the default language, ignoring user language settings. */
  fixedLanguage?: boolean;
  /** If true, the localization will fetch the translations from the folder. */
  fetchFolder?: boolean;
}

/**
 * Localization class handles loading and retrieving translation strings
 * from library and mod-specific language files.
 */
export class Localization {
  private static LibTranslation: TranslationDict = {};
  private static ModTranslation: TranslationDict = {};
  private static PathToModTranslation: string | undefined;
  private static PathToLibTranslation: string = `${PUBLIC_URL}/dl_translations/`;
  private static DefaultLanguage: string = 'en';
  private static FetchFolder: boolean = false;
  private static initialized = false;

  /** Initialize the localization system by loading translation files. */
  static async init(initOptions?: TranslationOptions) {
    if (Localization.initialized) return;
    Localization.initialized = true;

    Localization.PathToModTranslation = (() => {
      if (!initOptions?.pathToTranslationsFolder) return undefined;

      return initOptions.pathToTranslationsFolder.endsWith('/') ?
        initOptions.pathToTranslationsFolder :
        `${initOptions.pathToTranslationsFolder}/`;
    })();

    Localization.DefaultLanguage = initOptions?.defaultLanguage || Localization.DefaultLanguage;
    Localization.FetchFolder = initOptions?.fetchFolder || Localization.FetchFolder;

    const lang = initOptions?.fixedLanguage ? Localization.DefaultLanguage : TranslationLanguage.toLowerCase();

    const libTranslation = await Localization.fetchTranslation(Localization.PathToLibTranslation, lang);
    if (lang === Localization.DefaultLanguage) {
      Localization.LibTranslation = libTranslation;
    } else {
      const fallbackTranslation = await Localization.fetchTranslation(Localization.PathToLibTranslation, Localization.DefaultLanguage);
      Localization.LibTranslation = { ...fallbackTranslation, ...libTranslation };
    }

    if (!Localization.PathToModTranslation) return;
    const modTranslation = await Localization.fetchTranslation(Localization.PathToModTranslation, lang, Localization.FetchFolder);
    if (lang === Localization.DefaultLanguage) {
      Localization.ModTranslation = modTranslation;
    } else {
      const fallbackTranslation = await Localization.fetchTranslation(Localization.PathToModTranslation, Localization.DefaultLanguage, Localization.FetchFolder);
      Localization.ModTranslation = { ...fallbackTranslation, ...modTranslation };
    }
  }

  /** Get a translated string from mod translations by source tag. */
  static getTextMod(srcTag: string): string | undefined {
    return Localization.ModTranslation?.[srcTag] || undefined;
  }

  /** Get a translated string from library translations by source tag. */
  static getTextLib(srcTag: string): string | undefined {
    return Localization.LibTranslation?.[srcTag] || undefined;
  }

  private static async fetchTranslation(baseUrl: string, lang: string, fetchFolder: boolean = false): Promise<TranslationDict> {
    if (fetchFolder) {
      const folderUrl = `${baseUrl}${lang}/`;
      const folderTranslation = await this.fetchLanguageFolder(folderUrl);

      if (Object.keys(folderTranslation).length > 0) {
        return folderTranslation;
      }
    }

    const fileUrl = `${baseUrl}${lang}.lang`;
    const response = await Localization.fetchLanguageFile(fileUrl);

    if (lang !== Localization.DefaultLanguage && !response) {
      const fallBackUrl = `${baseUrl}${Localization.DefaultLanguage}.lang`;
      const fallBackTranslation = await this.fetchLanguageFile(fallBackUrl) || {};
      return fallBackTranslation;
    }

    return response || {};
  }

  /**
   * Fetch and parse a single translation file for a given language.
   * Only requests `${baseUrl}${lang}.lang` and returns its parsed contents,
   * or an empty dictionary if the file cannot be fetched.
   */
  private static async fetchLanguageFile(fileUrl: string): Promise<TranslationDict | false> {
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return false;
    }

    const langFileContent = await response.text();
    return this.parseTranslation(langFileContent);
  }

  /**
   * Fetch and parse all translation files from a language folder.
   * First attempts to load a manifest file listing all translation files,
   * then falls back to trying common file names.
   * Returns empty dict if folder doesn't exist or has no valid files.
   */
  private static async fetchLanguageFolder(folderUrl: string): Promise<TranslationDict> {
    const translations: TranslationDict = {};

    const manifestFile = 'manifest.txt';
    let fileList: string[] | null = null;

    const response = await fetch(`${folderUrl}${manifestFile}`);
    if (response.ok) {
      const content = (await response.text()).trim();

      fileList = content.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith('#'));
    }

    if (fileList && fileList.length > 0) {
      const filePromises = fileList.map(async (filename) => {
        try {
          const fileTranslation = await Localization.fetchLanguageFile(`${folderUrl}${filename}`);
          if (fileTranslation) {
            return fileTranslation;
          }
        } catch {
          // Ignore fetch errors for individual files
        }
        return {};
      });

      const fileResults = await Promise.all(filePromises);
      for (const fileDict of fileResults) {
        Object.assign(translations, fileDict);
      }

      if (Object.keys(translations).length > 0) {
        return translations;
      }
    }

    return translations;
  }

  /**
   * Parse the raw content of a language file into a TranslationDict.
   * Ignores empty lines and comments starting with '#'.
   */
  private static parseTranslation(content: string): TranslationDict {
    const translations: TranslationDict = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...rest] = trimmed.split('=');
      translations[key.trim()] = rest.join('=').trim();
    }

    return translations;
  }
}

/**
 * Retrieve a localized string for the given source tag.
 * First attempts to get the mod-specific translation,
 * then falls back to the library translation,
 * and if neither exist, returns the source tag itself.
 */
export const getText = (srcTag: string, replacements?: Record<string, string | number | boolean>): string => {
  const text = Localization.getTextMod(srcTag) || Localization.getTextLib(srcTag) || srcTag;

  if (replacements) {
    const allStringReplacements = Object.fromEntries(Object.entries(replacements).map(([key, value]) => [key, value.toString()]));
    return CommonStringPartitionReplace(text, allStringReplacements).join('');
  }

  return text;
};
