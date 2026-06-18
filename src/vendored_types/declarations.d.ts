/**
 * Base public URL used for loading assets (e.g., images, translation files).
 * 
 * This value is set at build time and configured via `deeplib.config.js`.
 */
declare const PUBLIC_URL: string;

/**
 * Whether public assets were embedded into the JS bundle at build time.
 */
declare const ARE_PUBLIC_ASSETS_BUNDLED: boolean;

/**
 * Map of public asset paths to their bundled contents.
 * Text assets contain raw file contents; binary assets contain data URLs.
 */
declare const BUNDLED_PUBLIC_ASSET_MAP: Record<string, string>;

/**
 * The current mod version.
 * 
 * This value is set at build time and configured via `version` field in the `package.json` file.
 * @example
 * ```json
 * {
 *  "name": "example-mod",
 *  "version": "1.0.0",
 *  "author": "your-name",
 * }
 *  ```
 */
declare const MOD_VERSION: string;

/**
 * The unique hash of the current commit.
 * 
 * The hash is computed automatically from the current commit.
 * 
 * Used for build identification.
 * @example "a1b2c3d4"
 */
declare const COMMIT_HASH: string;

/**
 * The current mod version caption.
 * 
 * This value is computed at build time depending on IS_DEVEL.
 * @example
 * IS_DEVEL === true ? "1.0.0 (a1b2c3d4)" : "1.0.0"
 */
declare const MOD_VERSION_CAPTION: string;

/**
 * Whether the build is a development build.
 * 
 * `true` for development/local builds, `false` for production.
 */
declare const IS_DEVEL: boolean;

/**
 * Whether debugging features are enabled.
 * 
 * `true` when mod is built with `--debug`/`-d`.
 */
declare const IS_DEBUG: boolean;

/**
 * The current Deeplib version.
 * 
 * This value is set at build time and configured via `version` field in the `package.json` file of this package.
 */
declare const DEEPLIB_VERSION: string;

/**
 * The current mod info.
 * 
 * This value is set at build time and configured via `modInfo` field in the `deeplib.config.js` file.
 */
declare const MOD_INFO: Omit<ModSDKModInfo, 'version'>;