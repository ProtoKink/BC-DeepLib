#!/usr/bin/env node
// @ts-check

import { exec } from 'child_process';
import { watch } from 'chokidar';
import { build } from 'esbuild';
import progress from 'esbuild-plugin-progress';
import time from 'esbuild-plugin-time';
import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync } from 'fs';
import path, { dirname } from 'path';
import simpleGit from 'simple-git';
import { fileURLToPath, pathToFileURL } from 'url';
import { promisify } from 'util';
import http from 'http';
import serveStatic from 'serve-static';
import finalhandler from 'finalhandler';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @param {import('./build').BuildConfig} config 
 * @returns {Required<import('./build').BuildConfig>}
 */
export function defineConfig(config) {
  return {
    entry: 'index.ts',
    outfile: 'index.js',
    distDirName: 'dist',
    publicDirName: 'public',
    scripts: [],
    target: [],
    plugins: [],
    defines: {},
    host: 'localhost',
    port: 45000,
    ...config
  };
}

async function runDeeplibBuild() {
  const configPath = path.resolve(process.cwd(), 'deeplib.config.js');

  if (!existsSync(configPath)) {
    console.error('❌ Missing deeplib.config.js in project root');
    process.exit(1);
  }

  const { default: config } = await import(pathToFileURL(configPath).toString());
  await buildMod(config);
}

/**
 * @param {Required<import('./build').BuildConfig>} config 
 */
async function buildMod({
  entry,
  outfile,
  globalName,
  distDirName,
  publicDirName,
  scripts,
  prodRemoteURL,
  devRemoteURL,
  target,
  plugins,
  defines,
  host,
  port
}) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
			Usage: deeplib [options]

			Options:
				--help, -h              Show this help message
				--watch, -w             Watch for changes and rebuild
				--serve, -s             Serve mod on http://${host}:${port}
				--lib-local, -l         Use local build of deeplib
				--debug, -d             Enable debug mode
		`.replaceAll('\t', ''));
    return;
  }
  const cliLocal = !process.env.environment;
  const cliWatch = process.argv.includes('--watch') || process.argv.includes('-w');
  const cliServe = process.argv.includes('--serve') || process.argv.includes('-s');
  const cliLibLocal = process.argv.includes('--lib-local') || process.argv.includes('-l');
  const cliAllowDebug = process.argv.includes('--debug') || process.argv.includes('-d');

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
    entryPoints: [`src/${entry}`],
    outfile: `${distDirName}/${outfile}`,
    format: 'iife',
    globalName,
    bundle: true,
    sourcemap: true,
    target,
    treeShaking: true,
    keepNames: true,
    define: {
      PUBLIC_URL: JSON.stringify(PUBLIC_URL),
      MOD_VERSION: JSON.stringify(VERSION),
      COMMIT_HASH: JSON.stringify(COMMIT_HASH),
      MOD_VERSION_CAPTION: JSON.stringify(VERSION_CAPTION),
      IS_DEVEL: JSON.stringify(IS_DEVEL),
      IS_DEBUG: JSON.stringify(cliAllowDebug),
      ...defines
    },
    plugins: [progress(), time(), ...plugins],
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

runDeeplibBuild();