import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Content roots: builtin/ ships inside the app, remote/ is delivered only. */
export const ROOTS = {
  builtin: join(import.meta.dirname, '..', 'builtin'),
  remote: join(import.meta.dirname, '..', 'remote'),
} as const;

export type Root = keyof typeof ROOTS;

/** Collection files that hold an array of items, by manifest key. */
export const COLLECTION_FILES = {
  characters: 'characters.json',
  layouts: 'layouts.json',
  stamps: 'stamps.json',
  phrases: 'phrases.json',
  aiStyles: 'ai-styles.json',
} as const;

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Films live one per file (as the film studio exports them). */
export function filmFiles(root: Root): string[] {
  const directory = join(ROOTS[root], 'films');
  try {
    return readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(directory, name));
  } catch {
    return [];
  }
}

/** The raw (unvalidated) manifest of one root. */
export function readRawManifest(root: Root): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    films: filmFiles(root).map(readJson),
  };
  for (const [key, file] of Object.entries(COLLECTION_FILES)) {
    try {
      manifest[key] = readJson(join(ROOTS[root], file));
    } catch {
      manifest[key] = [];
    }
  }
  return manifest;
}

/** Every `{ path, sha256 }` in a JSON value, wherever it is nested. */
export function findAssetRefs(value: unknown): { path: string; sha256: string }[] {
  if (Array.isArray(value)) return value.flatMap(findAssetRefs);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (typeof record.path === 'string' && typeof record.sha256 === 'string') {
    return [record as { path: string; sha256: string }];
  }
  return Object.values(record).flatMap(findAssetRefs);
}
