// Runs shared tools from the Desktop checkout so the browser uses the same toolchain.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { linkedWevirDir, WEB_ROOT } from './wevir-dir.mjs';

const [tool, ...args] = process.argv.slice(2);
if (!['tsc', 'biome', 'vitest', 'vite'].includes(tool)) {
  console.error(`unknown tool ${tool}; one of tsc, biome, vitest, vite`);
  process.exit(2);
}
const bin = join(
  linkedWevirDir(),
  tool === 'vite' ? 'apps/desktop/node_modules/.bin' : 'node_modules/.bin',
  tool,
);
if (!existsSync(bin)) {
  console.error(`${bin} is missing: run \`pnpm run setup\``);
  process.exit(1);
}
const result = spawnSync(bin, args, { cwd: WEB_ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
