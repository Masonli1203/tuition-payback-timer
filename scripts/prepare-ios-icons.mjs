import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep the approved, opaque artwork outside Tauri's regenerated Xcode project.
// iOS applies the corner mask; source.png is deliberately a full square.
export async function prepareIOSIcons() {
  const source = fileURLToPath(new URL('../ios/Icons/source.png', import.meta.url));
  const destination = fileURLToPath(new URL('../src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/', import.meta.url));
  const manifest = await readFile(new URL('../ios/Icons/Contents.json', import.meta.url), 'utf8');
  await mkdir(destination, { recursive: true });
  for (const image of JSON.parse(manifest).images) {
    const pixels = Number(image.size.split('x')[0]) * Number(image.scale.replace('x', ''));
    const result = spawnSync('/usr/bin/sips', [
      '-z', String(pixels), String(pixels), source, '--out', `${destination}${image.filename}`,
    ], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error(result.error?.message || result.stderr || result.stdout);
    }
  }
  await writeFile(`${destination}Contents.json`, manifest);
  console.log('Prepared iOS app icons from ios/Icons/source.png.');
}
