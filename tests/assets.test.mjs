import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appAssets } from '../scripts/app-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('desktop preparation removes stale assets and embeds exactly the public source files', async t => {
  const temporaryRoot = await realpath(tmpdir());
  const workspace = await mkdtemp(path.join(temporaryRoot, 'tuition-assets-'));
  t.after(async () => {
    const target = await realpath(workspace);
    assert.equal(path.dirname(target), temporaryRoot);
    assert(path.basename(target).startsWith('tuition-assets-'));
    await rm(target, { recursive: true });
  });
  await mkdir(path.join(workspace, 'scripts'));
  await mkdir(path.join(workspace, 'dist'));
  for (const file of [...appAssets.keys(), 'scripts/prepare-desktop.mjs', 'scripts/app-assets.mjs']) {
    await copyFile(path.join(root, file), path.join(workspace, file));
  }
  await writeFile(path.join(workspace, 'dist', 'obsolete.mjs'), 'stale build');
  const build = spawn(process.execPath, ['scripts/prepare-desktop.mjs'], { cwd: workspace, windowsHide: true, stdio: 'pipe' });
  assert.equal((await once(build, 'exit'))[0], 0);
  assert.deepEqual((await readdir(path.join(workspace, 'dist'))).sort(), [...appAssets.keys()].sort());
  for (const file of appAssets.keys()) {
    assert.deepEqual(await readFile(path.join(workspace, 'dist', file)), await readFile(path.join(root, file)));
  }
});

test('local server serves all packaged modules, supports HEAD and keeps private files inaccessible', async t => {
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: 'pipe',
  });
  t.after(() => server.kill());
  const [output] = await once(server.stdout, 'data', { signal: AbortSignal.timeout(10000) });
  const origin = /http:\/\/127\.0\.0\.1:\d+/.exec(output.toString())?.[0];
  assert(origin, output.toString());
  for (const [file, contentType] of appAssets) {
    const response = await fetch(`${origin}/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('content-type'), contentType);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(root, file)));
  }
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  for (const file of ['MEMORY.md', 'package.json', 'backups/example.json', 'src-tauri/src/main.rs', 'scripts/app-assets.mjs']) {
    assert.equal((await fetch(`${origin}/${file}`)).status, 404);
  }
});
