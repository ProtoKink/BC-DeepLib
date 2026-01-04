#!/usr/bin/env node
// @ts-check

import { exec } from 'child_process';
import { watch } from 'chokidar';
import { build } from 'esbuild';
import progress from 'esbuild-plugin-progress';
import time from 'esbuild-plugin-time';
import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import path, { dirname } from 'path';
import simpleGit from 'simple-git';
import { fileURLToPath, pathToFileURL } from 'url';
import { promisify } from 'util';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';
import { Command } from 'commander';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const thisVersion = packageJson.version;

/**
 * @param {import('./build').BuildConfig} config 
 * @param {import('esbuild').BuildOptions} [esbuildOptions]
 * @returns {import('./build').BuildConfig}
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
 * @param {Required<import('./build').BuildConfig>} config 
 * @param {{ watch?: boolean, serve?: boolean, libLocal?: boolean, debug?: boolean }} options
 */
async function buildMod({
  entry,
  outfile,
  distDirName,
  publicDirName,
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
    if (await simpleGit().checkIsRepo()) {
      COMMIT_HASH = (await simpleGit().log({ maxCount: 1 }))?.latest?.hash?.substring(0, 8) ?? '';
    }
  } catch (_) {
    COMMIT_HASH = 'unknown';
  }
  const VERSION_CAPTION = IS_DEVEL ? `${VERSION} - ${COMMIT_HASH}` : VERSION;

  /** @type {import('esbuild').BuildOptions} */
  const buildOptions = {
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
      MOD_VERSION: JSON.stringify(VERSION),
      COMMIT_HASH: JSON.stringify(COMMIT_HASH),
      MOD_VERSION_CAPTION: JSON.stringify(VERSION_CAPTION),
      IS_DEVEL: JSON.stringify(IS_DEVEL),
      IS_DEBUG: JSON.stringify(cliAllowDebug),
      ...(esbuildOptions.define || {})
    },
    plugins: [progress(), time(), ...(esbuildOptions.plugins || [])]
  };

  /** @type {NodeJS.Timeout | null} */
  let buildTimeout = null;
  const DEBOUNCE_MS = 100; // Adjust as needed

  function debounceRunBuild() {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(runBuild, DEBOUNCE_MS);
  }

  async function runBuild() {
    const assetsSrc = path.resolve(__dirname, '../dist/public');
    const assetsDest = path.resolve(process.cwd(), distDirName, publicDirName);

    try {
      await build(buildOptions);
      copyMatchingFiles(assetsSrc, assetsDest);

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
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  });

  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });

  server.listen(port, host, () => {
    console.log(`🌐 Server running at http://${host}:${port}`);
  });
}

/**
 * @param {string} inputDir
 * @param {string} outputDir
 */
function copyMatchingFiles(inputDir, outputDir) {
  if (!existsSync(inputDir)) {
    console.warn(`⚠️ ${relativeToProject(inputDir)} is not found.`);
    return;
  }

  const extensions = ['html', 'js', 'css', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'lang'];

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const items = readdirSync(inputDir, { withFileTypes: true });

  for (const item of items) {
    const srcPath = path.join(inputDir, item.name);
    const destPath = path.join(outputDir, item.name);

    if (item.isDirectory()) {
      copyMatchingFiles(srcPath, destPath);
    } else if (item.isFile()) {
      const ext = path.extname(item.name).slice(1).toLowerCase();
      if (extensions.includes(ext)) {
        copyFileSync(srcPath, destPath);
      }
    }
  }
  console.info(`📁 Copied assets from ${relativeToProject(inputDir)} to ${relativeToProject(outputDir)}`);
}

/**
 * @param {string} absolutePath
 */
function relativeToProject(absolutePath) {
  return path.relative(process.cwd(), absolutePath);
}

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