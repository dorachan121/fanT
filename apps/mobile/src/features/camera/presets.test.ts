import { describe, expect, it } from 'vitest';

import {
  BEAUTY_LEVEL_LABELS,
  FILM_PRESET_LABELS,
  NEXT_BEAUTY_LEVEL,
  NEXT_FILM_PRESET,
} from './presets';

/** Follows `next` from `start` until it returns to `start`. */
function cycleFrom<T extends string>(next: Record<T, T>, start: T): T[] {
  const visited: T[] = [start];
  for (let current = next[start]; current !== start; current = next[current]) {
    if (visited.length > Object.keys(next).length) throw new Error('Cycle never returns');
    visited.push(current);
  }
  return visited;
}

describe.each([
  ['film presets', NEXT_FILM_PRESET, FILM_PRESET_LABELS],
  ['beauty levels', NEXT_BEAUTY_LEVEL, BEAUTY_LEVEL_LABELS],
] as const)('%s', (_, next, labels) => {
  it('cycle through every option exactly once from any starting point', () => {
    for (const start of Object.keys(labels) as (keyof typeof labels)[]) {
      expect(cycleFrom<string>(next, start).sort()).toEqual(Object.keys(labels).sort());
    }
  });
});
