// Where the wevir checkout is. The default is the pinned submodule (./wevir); WEVIR_DIR points at another checkout, for
// example a worktree with renderer changes that are not on the pinned commit yet. Everything else goes through `.wevir`,
// a symlink that `pnpm run setup` points at the chosen checkout.
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LINK = join(WEB_ROOT, '.wevir');

export function chosenWevirDir() {
  return resolve(WEB_ROOT, process.env.WEVIR_DIR ?? 'wevir');
}

/** The checkout `.wevir` points at, resolved. Throws with a hint when setup has not run. */
export function linkedWevirDir() {
  if (!existsSync(join(LINK, 'package.json'))) {
    throw new Error('.wevir is missing: run `pnpm run setup` first');
  }
  return realpathSync(LINK);
}
