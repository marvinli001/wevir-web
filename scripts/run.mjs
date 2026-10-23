// Runs a tool from the wevir checkout's root install (`.wevir`): TypeScript, Biome and Vitest at the versions wevir uses.
// Vite comes from the desktop app's dependencies through the `node_modules` link and runs as `vite` directly.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { linkedWevirDir, WEB_ROOT } from './wevir-dir.mjs';

const [tool, ...args] = process.argv.slice(2);
if (!['tsc', 'biome', 'vitest'].includes(tool)) {
  console.error(`unknown tool ${tool}; one of tsc, biome, vitest`);
  process.exit(2);
}
const bin = join(linkedWevirDir(), 'node_modules/.bin', tool);
if (!existsSync(bin)) {
  console.error(`${bin} is missing: run \`pnpm run setup\``);
  process.exit(1);
}
const result = spawnSync(bin, args, { cwd: WEB_ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
