import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'wevir-web-setup-')));
  folders.push(root);
  const web = join(root, 'web');
  const desktop = join(root, 'desktop');
  const bin = join(root, 'bin');
  for (const folder of [join(web, 'scripts'), bin]) mkdirSync(folder, { recursive: true });
  for (const name of ['setup.mjs', 'wevir-dir.mjs']) {
    copyFileSync(new URL(`../scripts/${name}`, import.meta.url), join(web, 'scripts', name));
  }
  writeFileSync(join(web, 'package.json'), JSON.stringify({ devDependencies: { scanner: '1' } }));
  mkdirSync(join(desktop, 'apps/desktop/node_modules/@types/react'), { recursive: true });
  mkdirSync(join(desktop, 'apps/desktop/node_modules/react'));
  writeFileSync(
    join(desktop, 'apps/desktop/package.json'),
    JSON.stringify({ devDependencies: { react: '19', '@types/react': '19' } }),
  );
  writeFileSync(
    join(bin, 'pnpm'),
    String.raw`#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.INSTALL_LOG, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }) + '\n');
fs.mkdirSync('node_modules', { recursive: true });
if (process.cwd() === process.env.WEB_ROOT) fs.mkdirSync('node_modules/scanner', { recursive: true });
`,
    { mode: 0o755 },
  );
  const run = () =>
    spawnSync(process.execPath, [join(web, 'scripts/setup.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CI: '1',
        WEVIR_DIR: desktop,
        WEB_ROOT: web,
        INSTALL_LOG: join(root, 'installs.jsonl'),
      },
    });
  return { root, web, desktop, run };
}

describe('Desktop dependency setup', () => {
  it('migrates the old directory link without installing browser packages into Desktop', () => {
    const { root, web, desktop, run } = fixture();
    symlinkSync(join(desktop, 'apps/desktop/node_modules'), join(web, 'node_modules'));
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(realpathSync(join(web, 'node_modules/react'))).toBe(
      join(desktop, 'apps/desktop/node_modules/react'),
    );
    expect(realpathSync(join(web, 'node_modules/@types/react'))).toBe(
      join(desktop, 'apps/desktop/node_modules/@types/react'),
    );
    expect(realpathSync(join(web, 'node_modules/scanner'))).toBe(join(web, 'node_modules/scanner'));
    expect(existsSync(join(desktop, 'apps/desktop/node_modules/scanner'))).toBe(false);
    const installs = readFileSync(join(root, 'installs.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(installs).toEqual([
      { cwd: desktop, args: ['install', '--frozen-lockfile'] },
      { cwd: web, args: ['install', '--frozen-lockfile'] },
    ]);
    expect(run().status).toBe(0);
  });

  it('refuses to replace a real shared package directory', () => {
    const { web, run } = fixture();
    mkdirSync(join(web, 'node_modules/react'), { recursive: true });
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exists and is not a symlink');
    expect(realpathSync(join(web, 'node_modules/react'))).toBe(join(web, 'node_modules/react'));
  });
});
