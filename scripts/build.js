import esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

esbuild.build({
  entryPoints: [path.join(SRC_DIR, 'deeplib.ts')],
  outfile: path.join(DIST_DIR, 'deeplib.js'),
  format: 'esm',
  bundle: true,
  sourcemap: true,
  keepNames: true,
  target: 'es2022',
  platform: 'browser',
  minify: true,
  plugins: [
    sassPlugin({
      type: 'css-text',
    })
  ],
  define: {
    'DEEPLIB_VERSION': JSON.stringify(packageJson.version),
  }
}).then(() => {
  console.log('Successfully bundled deeplib.js');
}).catch((error) => {
  console.error('Build failed:', error);
  throw error;
});

