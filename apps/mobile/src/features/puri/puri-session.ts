import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import type { DecoLayer } from '../photo/recipe';

/** One purikura shot, already cropped to its cell and rendered with the puri look. */
export interface PuriShot {
  readonly uri: string;
  readonly deco: readonly DecoLayer[];
}

/** Shots live in the cache until the sheet is finished; they never reach the album alone. */
const SHOTS = new Directory(Paths.cache, 'puri');

interface PuriSession {
  readonly layoutId: string | null;
  readonly shots: readonly (PuriShot | null)[];
  readonly start: (layoutId: string, cellCount: number) => void;
  readonly setShot: (index: number, jpeg: Uint8Array) => void;
  readonly setDeco: (index: number, deco: readonly DecoLayer[]) => void;
  readonly reset: () => void;
}

function clearShots(): void {
  if (SHOTS.exists) SHOTS.delete();
}

/** The purikura in progress (S-30–S-34). */
export const usePuriSession = create<PuriSession>()((set, get) => ({
  layoutId: null,
  shots: [],
  start: (layoutId, cellCount) => {
    clearShots();
    set({ layoutId, shots: Array.from({ length: cellCount }, () => null) });
  },
  setShot: (index, jpeg) => {
    SHOTS.create({ intermediates: true, idempotent: true });
    // A new file name per take, so a retake never shows a cached image.
    const file = new File(SHOTS, `${String(index)}-${String(Date.now())}.jpg`);
    file.writeSync(jpeg);
    const previous = get().shots[index];
    if (previous !== null && previous !== undefined) {
      const old = new File(previous.uri);
      if (old.exists) old.delete();
    }
    set((state) => ({
      shots: state.shots.map((shot, i) => (i === index ? { uri: file.uri, deco: [] } : shot)),
    }));
  },
  setDeco: (index, deco) => {
    set((state) => ({
      shots: state.shots.map((shot, i) =>
        i === index && shot !== null ? { ...shot, deco } : shot,
      ),
    }));
  },
  reset: () => {
    clearShots();
    set({ layoutId: null, shots: [] });
  },
}));
