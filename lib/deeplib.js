#!/usr/bin/env node
// @ts-check

import { exec } from 'child_process';
import { watch } from 'chokidar';
import { Command } from 'commander';
import { build } from 'esbuild';
import progress from 'esbuild-plugin-progress';
import time from 'esbuild-plugin-time';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import http from 'http';
import * as path from 'path';
import { dirname } from 'path';
import serveStatic from 'serve-static';
import { simpleGit } from 'simple-git';
import { fileURLToPath, pathToFileURL } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const thisVersion = packageJson.version;

/**
 * @param {{ watch?: boolean, serve?: boolean, libLocal?: boolean, debug?: boolean }} options
 */
async function runDeeplib(options) {
  const configPath = path.resolve(process.cwd(), 'deeplib.config.js');

  if (!existsSync(configPath)) {
    console.error('❌ Missing deeplib.config.js in project root');
    console.error('💡 Run "deeplib init" to create a default config file');
    process.exit(1);
  }

  const { default: config } = await import(pathToFileURL(configPath).toString());
  await buildMod(config, options);
}

/**
 * @param {Required<import('./deeplib.js').BuildConfig>} config 
 * @param {{ watch?: boolean, serve?: boolean, libLocal?: boolean, debug?: boolean }} options
 */
async function buildMod({
  entry,
  outfile,
  modInfo,
  distDirName,
  publicDirName,
  doBundlePublicAssets,
  scripts,
  prodRemoteURL,
  devRemoteURL,
  host,
  port,
  esbuildOptions = {}
}, options = {}) {
  const cliLocal = !process.env.environment;
  const cliWatch = options.watch || false;
  const cliServe = options.serve || false;
  const cliLibLocal = options.libLocal || false;
  const cliAllowDebug = options.debug || false;

  const envMode = process.env.environment || 'production';
  const mode = cliLocal ? 'local' : envMode;

  const isDev = mode === 'development';
  const isLocal = mode === 'local';
  const isWatch = cliWatch;
  const isServe = cliServe;
  const IS_DEVEL = isDev || isLocal;

  const remotePath = isDev ? devRemoteURL : prodRemoteURL;
  const localPath = `http://${host}:${port}`;
  const PUBLIC_URL = `${isLocal ? localPath : remotePath}/${publicDirName}`;

  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const VERSION = packageJson.version;

  let COMMIT_HASH = '';
  try {
    const git = simpleGit();
    if (await git.checkIsRepo()) {
      COMMIT_HASH = (await git.log({ maxCount: 1 }))?.latest?.hash?.substring(0, 8) ?? '';
    }
  } catch (_) {
    COMMIT_HASH = 'unknown';
  }
  const VERSION_CAPTION = IS_DEVEL ? `${VERSION} - ${COMMIT_HASH}` : VERSION;

  const deeplibPublicDir = path.resolve(__dirname, '../dist/public');
  const modPublicDir = path.resolve(process.cwd(), publicDirName);

  /**
   * @param {Record<string, string>} bundledPublicAssets
   * @returns {import('esbuild').BuildOptions}
   */
  function createBuildOptions(bundledPublicAssets) {
    return {
      format: 'iife',
      bundle: true,
      sourcemap: true,
      treeShaking: true,
      keepNames: true,
      ...esbuildOptions,
      entryPoints: [`src/${entry}`],
      outfile: `${distDirName}/${outfile}`,
      define: {
        PUBLIC_URL: JSON.stringify(PUBLIC_URL),
        ARE_PUBLIC_ASSETS_BUNDLED: JSON.stringify(doBundlePublicAssets),
        BUNDLED_PUBLIC_ASSET_MAP: JSON.stringify(bundledPublicAssets),
        MOD_VERSION: JSON.stringify(VERSION),
        COMMIT_HASH: JSON.stringify(COMMIT_HASH),
        MOD_VERSION_CAPTION: JSON.stringify(VERSION_CAPTION),
        IS_DEVEL: JSON.stringify(IS_DEVEL),
        IS_DEBUG: JSON.stringify(cliAllowDebug),
        MOD_INFO: JSON.stringify(modInfo),
        ...(esbuildOptions.define || {})
      },
      plugins: [
        progress(),
        time(),
        ...(doBundlePublicAssets ? [createBundlePublicAssetsPlugin(PUBLIC_URL, bundledPublicAssets)] : []),
        ...(esbuildOptions.plugins || [])
      ]
    };
  }

  /** @type {NodeJS.Timeout | null} */
  let buildTimeout = null;
  const DEBOUNCE_MS = 100; // Adjust as needed

  function debounceRunBuild() {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(runBuild, DEBOUNCE_MS);
  }

  async function runBuild() {
    const assetsDest = path.resolve(process.cwd(), distDirName, publicDirName);
    const bundledPublicAssets = doBundlePublicAssets
      ? collectPublicAssets([deeplibPublicDir, modPublicDir])
      : {};

    try {
      await build(createBuildOptions(bundledPublicAssets));

      if (!doBundlePublicAssets) {
        copyDirectoryContents(deeplibPublicDir, assetsDest);
        copyDirectoryContents(modPublicDir, assetsDest);
      } else {
        console.info(`📦 Bundled ${Object.keys(bundledPublicAssets).length} public assets into ${outfile}`);
      }

      for (const script of scripts) {
        const { stdout } = await execAsync(`node ${script}`);
        console.log(stdout);
      }
    } catch (error) {
      console.error(error);
    }
  }

  await runBuild();

  if (isLocal) {

    if (isWatch) {
      const watchDirs = ['./src', `./${publicDirName}`];
      if (cliLibLocal) {
        watchDirs.push('./node_modules/bc-deeplib/dist/deeplib.js');
        watchDirs.push('./node_modules/bc-deeplib/dist/public/**/*');
      }
      const watcher = watch(watchDirs, {
        ignoreInitial: true
      });
      watcher.on('change', debounceRunBuild);
      console.info('🔭 Watching for changes...');
    }

    if (isServe) {
      try {
        serveWithCORS(distDirName, port, host);
      } catch (err) {
        console.error(err);
      }
    }
  }
}

/**
 * @param {string} dir 
 * @param {number} port 
 * @param {string} host 
 */
function serveWithCORS(dir, port, host) {
  const serve = serveStatic(dir, {
    /** @param {import('http').ServerResponse} res */
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  });

  const server = http.createServer((req, res) => {
    serve(req, res, (err) => {
      if (err) {
        res.statusCode = err.statusCode || 500;
        res.end(err.message || 'Internal Server Error');
        return;
      }

      res.statusCode = 404;
      res.end('Not Found');
    });
  });

  server.listen(port, host, () => {
    console.log(`🌐 Server running at http://${host}:${port}`);
  });
}

const FETCH_TEXT_ASSET_EXTENSIONS = new Set(['lang', 'json', 'xml', 'txt']);

/**
 * @param {string} assetPath
 */
function isFetchTextAssetPath(assetPath) {
  const ext = path.extname(assetPath).slice(1).toLowerCase();
  return FETCH_TEXT_ASSET_EXTENSIONS.has(ext);
}

/**
 * @param {string[]} directories Directories are merged in order; later entries override earlier ones.
 * @returns {Record<string, string>}
 */
function collectPublicAssets(directories) {
  /** @type {Record<string, string>} */
  const assets = {};

  for (const dir of directories) {
    if (!existsSync(dir)) {
      continue;
    }

    walkFiles(dir, dir, (absolutePath, relativePath) => {
      const assetPath = relativePath.replace(/\\/g, '/');
      const content = readFileSync(absolutePath);
      const mimeType = getAssetMimeType(assetPath);
      if (mimeType === 'application/octet-stream') {
        return;
      }

      assets[assetPath] = isFetchTextAssetPath(assetPath)
        ? content.toString('utf-8')
        : `data:${mimeType};base64,${content.toString('base64')}`;
    });
  }

  return assets;
}

/**
 * @param {string} publicUrl
 * @param {Record<string, string>} assets
 * @returns {import('esbuild').Plugin}
 */
function createBundlePublicAssetsPlugin(publicUrl, assets) {
  return {
    name: 'bundle-public-assets',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          return;
        }

        const outFile = build.initialOptions.outfile;
        if (!outFile || !existsSync(outFile)) {
          return;
        }

        let code = readFileSync(outFile, 'utf-8');
        let replacements = 0;

        for (const [assetPath, content] of Object.entries(assets)) {
          if (isFetchTextAssetPath(assetPath)) {
            continue;
          }

          const assetUrl = `${publicUrl}/${assetPath}`;
          const from = JSON.stringify(assetUrl);
          const to = JSON.stringify(content);
          const parts = code.split(from);

          if (parts.length > 1) {
            replacements += parts.length - 1;
            code = parts.join(to);
          }
        }

        writeFileSync(outFile, code);

        if (replacements > 0) {
          console.info(`📦 Replaced ${replacements} public asset URL(s) with bundled data URLs`);
        }
      });
    }
  };
}

// #region Common

/**
 * @param {string} absolutePath
 * @returns {string}
 */
function relativeToProject(absolutePath) {
  return path.relative(process.cwd(), absolutePath);
}

/**
 * @param {string} dir
 * @param {string} baseDir
 * @param {(absolutePath: string, relativePath: string) => void} callback
 */
function walkFiles(dir, baseDir, callback) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, item.name);

    if (item.isDirectory()) {
      walkFiles(absolutePath, baseDir, callback);
      continue;
    }

    if (!item.isFile()) {
      continue;
    }

    callback(absolutePath, path.relative(baseDir, absolutePath));
  }
}

/** @type {Record<string, string>} */
const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  css: 'text/css',
  html: 'text/html',
  txt: 'text/plain',
  lang: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  md: 'text/markdown',
  markdown: 'text/markdown',
};

/**
 * @param {string} assetPath
 * @returns {string}
 */
function getAssetMimeType(assetPath) {
  const ext = path.extname(assetPath).slice(1).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * @param {string} inputDir
 * @param {string} outputDir
 * @returns {void}
 */
function copyDirectoryContents(inputDir, outputDir) {
  if (!existsSync(inputDir)) {
    return;
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  for (const item of readdirSync(inputDir, { withFileTypes: true })) {
    const srcPath = path.join(inputDir, item.name);
    const destPath = path.join(outputDir, item.name);

    if (item.isDirectory()) {
      copyDirectoryContents(srcPath, destPath);
    } else if (item.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }

  console.info(`📁 Copied assets from ${relativeToProject(inputDir)} to ${relativeToProject(outputDir)}`);
}

// #endregion Common

// #region Config

/**
 * @param {import('./deeplib.js').BuildConfig} config
 * @param {import('esbuild').BuildOptions} esbuildOptions
 * @returns {import('./deeplib.js').BuildConfig}
 */
export function defineConfig(config, esbuildOptions) {
  const defaultEsbuildOptions = {
    target: [],
    plugins: [],
    define: {},
    ...esbuildOptions
  };

  return {
    distDirName: 'dist',
    publicDirName: 'public',
    doBundlePublicAssets: false,
    scripts: [],
    host: 'localhost',
    port: Math.min(3000, Math.floor(Math.random() * 10000)),
    ...config,
    // Merge esbuildOptions from parameter, default, and config
    esbuildOptions: {
      ...defaultEsbuildOptions,
      ...config.esbuildOptions,
      // Deep merge plugins array
      plugins: [
        ...(defaultEsbuildOptions.plugins || []),
        ...(config.esbuildOptions?.plugins || [])
      ],
      // Deep merge define object
      define: {
        ...(defaultEsbuildOptions.define || {}),
        ...(config.esbuildOptions?.define || {})
      }
    }
  };
}

/**
 * @returns {void}
 */
function initConfig() {
  const configPath = path.resolve(process.cwd(), 'deeplib.config.js');

  if (existsSync(configPath)) {
    console.error('❌ deeplib.config.js already exists in the project root');
    process.exit(1);
  }

  const defaultConfig = `import { defineConfig } from 'bc-deeplib/build';

export default defineConfig({
  entry: 'index.ts',
  outfile: 'index.js',
  modInfo: {
    name: 'ModName',
    fullName: 'ModFullName',
    repository: 'https://github.com/ModAuthor/ModRepository'
  },
  esbuildOptions: {
    globalName: 'ModName',
    target: ['es2020']
  }
});
`;

  writeFileSync(configPath, defaultConfig, 'utf-8');
  console.log('✅ Created deeplib.config.js with default configuration');
  console.log('📝 Please update the following in deeplib.config.js:');
  console.log('   - entry: path to your entry file in src/');
  console.log('   - outfile: name of the output file');
  console.log('   - esbuildOptions.globalName: your mod\'s global name');
  console.log('   - esbuildOptions.target: target JavaScript version(s)');
  console.log('   - Add any additional esbuild options in esbuildOptions');
}

// #endregion Config

const program = new Command();

program
  .name('deeplib')
  .description('Build tool for BC mods using DeepLib')
  .version(thisVersion);

program
  .command('init')
  .description('Create a default deeplib.config.js file')
  .action(() => {
    initConfig();
  });

// Build command (default)
program
  .option('-w, --watch', 'Watch for changes and rebuild')
  .option('-s, --serve', 'Serve mod on local dev server')
  .option('-l, --lib-local', 'Use local build of deeplib')
  .option('-d, --debug', 'Enable debug mode')
  .action(async (options) => {
    await runDeeplib(options);
  });

program.parse(process.argv);