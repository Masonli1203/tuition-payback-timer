import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { appAssets } from './app-assets.mjs';

const output = new URL('../dist/', import.meta.url);
// Read everything before touching the previous build; a missing source must fail.
const assets = await Promise.all([...appAssets.keys()].map(async file => [file, await readFile(new URL(`../${file}`, import.meta.url))]));
await mkdir(output, { recursive: true });
// Only remove stale direct files in this project's generated dist directory.
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.isFile() && !appAssets.has(entry.name)) await rm(new URL(entry.name, output));
}
await Promise.all(assets.map(([file, content]) => writeFile(new URL(file, output), content)));
console.log(`Prepared ${assets.length} embedded desktop assets.`);
