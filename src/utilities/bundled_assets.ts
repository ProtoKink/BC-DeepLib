import { HookPriority, sdk } from '../deeplib';

/** When public assets are bundled at build time, serve fetch requests from the
 * in-memory asset map instead of the remote public URL.
 */
export function installBundledPublicAssetFetch(): void {
  if (!ARE_PUBLIC_ASSETS_BUNDLED) return;

  const prefix = `${PUBLIC_URL}/`;

  sdk.hookFunction('fetch', HookPriority.ModifyBehavior, (args, next) => {
    const [input] = args;
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    if (url.startsWith(prefix)) {
      const assetPath = url.slice(prefix.length);
      const content = BUNDLED_PUBLIC_ASSET_MAP[assetPath];
      if (content !== undefined) {
        if (content.startsWith('data:')) {
          return fetch(content);
        }

        return Promise.resolve(new Response(content, { status: 200 }));
      }
    }

    return next(args);
  });
}
