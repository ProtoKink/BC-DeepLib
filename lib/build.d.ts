export declare interface BuildConfig {
  /** 
   * Entry file located in `src/`
   * @example 'index.ts'
   */
  entry: string,
  /** 
   * Output file located in `{distDirName}/`
   * @example 'index.js'
   */
  outfile: string,
  /** 
   * Mod info to register with the Mod SDK
   * @example { name: 'ModName', fullName: 'ModFullName', repository: 'https://github.com/ModAuthor/ModRepository' }
   */
  modInfo: Omit<import('bondage-club-mod-sdk').ModSDKModInfo, 'version'>,
  /** 
   * Directory name of the dist folder, where the mod will be built
   * @default 'dist'
   */
  distDirName?: string,
  /** 
   * Directory name of the public folder, where the mod assets will be copied
   * @default 'public'
   */
  publicDirName?: string,
  /** 
   * `node` scripts to run
   * @default []
   */
  scripts?: string[],
  /** URL to the mod on the production server */
  prodRemoteURL?: string,
  /** URL to the mod on the development server */
  devRemoteURL?: string,
  /** 
   * Host of the local dev server
   * @default 'localhost'
   */
  host?: string,
  /** 
   * Port of the local dev server
   * @default random port between 3000 and 10000
   */
  port?: number,
  /** Additional esbuild options (target, plugins, define, globalName, etc.) */
  esbuildOptions?: import('esbuild').BuildOptions,
} 

export declare function defineConfig(config: BuildConfig, esbuildOptions?: import('esbuild').BuildOptions): BuildConfig;