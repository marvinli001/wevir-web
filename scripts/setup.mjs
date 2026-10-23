// Points `.wevir` at the wevir checkout, installs its dependencies with wevir's own lockfile, and links `node_modules`
// to the desktop app's. wevir-web declares no npm dependencies of its own: React, Vite, Tailwind and the rest resolve to
// exactly the versions the desktop renderer ships with, through plain Node resolution, for Vite and TypeScript alike.
// Do not run `pnpm install` in wevir-web itself; run this instead.
//
//   pnpm run setup                         # the pinned submodule (git submodule update --init first)
//   WEVIR_DIR=../wevir pnpm run setup      # another checkout
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chosenWevirDir, LINK, WEB_ROOT } from './wevir-dir.mjs';

const target = chosenWevirDir();
if (!existsSync(join(target, 'apps/desktop/package.json'))) {
  console.error(`No wevir checkout at ${target}.`);
  console.error('Run `git submodule update --init`, or set WEVIR_DIR to a wevir checkout.');
  process.exit(1);
}

/** Replaces `path` with a symlink to `to` (relative). Refuses to touch a real directory. */
function link(path, to) {
  const wanted = relative(WEB_ROOT, to) || '.';
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    stat = undefined;
  }
  if (stat !== undefined && !stat.isSymbolicLink()) {
    console.error(`${path} exists and is not a symlink; remove it and run setup again.`);
    process.exit(1);
  }
  if (stat === undefined || readlinkSync(path) !== wanted) {
    rmSync(path, { force: true });
    symlinkSync(wanted, path, 'dir');
  }
  console.log(`${relative(WEB_ROOT, path)} -> ${wanted}`);
}

link(LINK, target);

const install = spawnSync('pnpm', ['install', ...(process.env.CI ? ['--frozen-lockfile'] : [])], {
  cwd: target,
  stdio: 'inherit',
});
if (install.status !== 0) process.exit(install.status ?? 1);

link(join(WEB_ROOT, 'node_modules'), join(target, 'apps/desktop/node_modules'));
