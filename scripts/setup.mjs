// Installs the browser-only dependencies, then links the shared dependencies from Desktop's locked install.
//
//   pnpm run setup                         # the pinned submodule (git submodule update --init first)
//   WEVIR_DIR=../wevir pnpm run setup      # another checkout
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { chosenWevirDir, LINK, WEB_ROOT } from './wevir-dir.mjs';

const target = chosenWevirDir();
if (!existsSync(join(target, 'apps/desktop/package.json'))) {
  console.error(`No wevir checkout at ${target}.`);
  console.error('Run `git submodule update --init`, or set WEVIR_DIR to a wevir checkout.');
  process.exit(1);
}

/** Replaces `path` with a symlink to `to` (relative). Refuses to touch a real directory with content of its own. */
function link(path, to) {
  const wanted = relative(dirname(path), to) || '.';
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
    mkdirSync(dirname(path), { recursive: true });
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

// Older setups linked the entire directory; remove only the link before installing Web's own packages.
const modules = join(WEB_ROOT, 'node_modules');
if (lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink()) rmSync(modules);
const browserInstall = spawnSync(
  'pnpm',
  ['install', ...(process.env.CI ? ['--frozen-lockfile'] : [])],
  {
    cwd: WEB_ROOT,
    stdio: 'inherit',
  },
);
if (browserInstall.status !== 0) process.exit(browserInstall.status ?? 1);

const desktop = JSON.parse(readFileSync(join(target, 'apps/desktop/package.json'), 'utf8'));
const browser = JSON.parse(readFileSync(join(WEB_ROOT, 'package.json'), 'utf8'));
const browserDependencies = { ...browser.dependencies, ...browser.devDependencies };
for (const name of Object.keys({ ...desktop.dependencies, ...desktop.devDependencies })) {
  if (Object.hasOwn(browserDependencies, name)) continue;
  link(join(modules, name), join(target, 'apps/desktop/node_modules', name));
}
