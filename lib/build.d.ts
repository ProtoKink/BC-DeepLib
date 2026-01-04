export declare interface BuildConfig {
  /** Entry file located in `src/` */
  entry: string,
  /** Output file located in `{distDirName}/` */
  outfile: string,
  /** Directory name of the dist folder, where the mod will be built */
  distDirName?: string,
  /** Directory name of the public folder, where the mod assets will be copied */
  publicDirName?: string,
  /** `node` scripts to run */
  scripts?: string[],
  /** URL to the mod on the production server */
  prodRemoteURL?: string,
  /** URL to the mod on the development server */
  devRemoteURL?: string,
  /** Host of the local dev server */
  host?: string,
  /** Port of the local dev server */
  port?: number
  /** Additional esbuild options (target, plugins, define, globalName, etc.) */
  esbuildOptions?: import('esbuild').BuildOptions
} 

export declare function defineConfig(config: BuildConfig, esbuildOptions?: import('esbuild').BuildOptions): BuildConfig;