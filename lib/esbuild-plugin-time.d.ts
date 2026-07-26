declare module 'esbuild-plugin-time' {
  import type { Plugin } from 'esbuild';

  export default function time(name?: string): Plugin;
}
