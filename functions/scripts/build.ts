/**
 * Bundles the functions into dist/ for deployment: workspace packages (api-types)
 * are inlined, Firebase SDKs stay external and are installed by Cloud Build from the
 * generated package.json, which has no workspace references.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};
const catalog = readFileSync(join(root, '..', 'pnpm-workspace.yaml'), 'utf8');

/** Resolves `catalog:` versions, since npm on Cloud Build does not know them. */
function resolveVersion(name: string, version: string): string {
  if (version !== 'catalog:') return version;
  const match = new RegExp(`^\\s+'?${name}'?: (\\S+)`, 'm').exec(catalog);
  if (match?.[1] === undefined) throw new Error(`No catalog version for ${name}`);
  return match[1];
}

rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(dist, 'index.js'),
  external: Object.keys(manifest.dependencies),
  sourcemap: true,
  legalComments: 'none',
});
writeFileSync(
  join(dist, 'package.json'),
  `${JSON.stringify(
    {
      name: 'fant-functions',
      private: true,
      type: 'module',
      main: 'index.js',
      engines: { node: '22' },
      dependencies: Object.fromEntries(
        Object.entries(manifest.dependencies).map(([name, version]) => [
          name,
          resolveVersion(name, version),
        ]),
      ),
    },
    null,
    2,
  )}\n`,
);
console.log('dist/index.js');
