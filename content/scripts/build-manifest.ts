/**
 * Builds what the content server delivers (CNT-01/02) into dist/: manifest.json
 * (built-in plus remote content, validated) and every asset at its manifest path.
 * CI uploads dist/ to the CDN; the app treats the download as untrusted and checks
 * it against the same schema and the asset hashes.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { mergeManifests, parseManifest } from '@fant/content-schema';

import { findAssetRefs, readRawManifest, ROOTS, type Root } from './collections';

const dist = join(import.meta.dirname, '..', 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const builtIn = parseManifest(readRawManifest('builtin'));
const remote = parseManifest(readRawManifest('remote'));
const manifest = mergeManifests(builtIn, remote);

for (const root of Object.keys(ROOTS) as Root[]) {
  for (const { path } of findAssetRefs(readRawManifest(root))) {
    const target = join(dist, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOTS[root], path), target);
  }
}
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest));
console.log(
  `dist/manifest.json: ${String(manifest.films.length)} films, ${String(manifest.characters.length)} characters, ${String(manifest.layouts.length)} layouts, ${String(manifest.stamps.length)} stamps`,
);
