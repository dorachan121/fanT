import { UPLOAD_LONG_EDGE, type ApiErrorCode, type Generation } from '@fant/api-types';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

import { resizeJpeg } from '../../engine/photo';
import { sleep } from '../../lib/sleep';
import { tempDirectory } from '../../lib/temp-files';
import { reportError, track } from '../analytics/analytics';
import { AiError, cancelGeneration, getGeneration, startGeneration } from './ai-client';
import { useAi } from './ai-store';

const POLL_MS = 2000;
/** The server times out at 60 s and refunds; the app stops waiting a little later. */
const GIVE_UP_MS = 120_000;

export type GenerationState =
  | { readonly phase: 'running'; readonly id: string | null }
  | { readonly phase: 'done'; readonly id: string; readonly resultUri: string }
  | { readonly phase: 'failed'; readonly code: ApiErrorCode | 'offline' }
  | { readonly phase: 'cancelled' };

/**
 * Runs one generation (S-43): uploads a downscaled copy (nothing larger leaves the
 * device), polls until it ends, then downloads the result. Cancelling refunds the
 * credit on the server.
 */
export function useGeneration(sourceUri: string, styleId: string) {
  const [state, setState] = useState<GenerationState>({ phase: 'running', id: null });
  const current = useRef<{ id: string | null; stopped: boolean }>({ id: null, stopped: false });
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    const run = current.current;
    run.stopped = false;
    // Start once per photo and style: a remount (e.g. React strict mode) must not
    // start, and pay for, a second generation.
    const key = `${styleId}|${sourceUri}`;
    if (startedFor.current === key) {
      return () => {
        run.stopped = true;
      };
    }
    startedFor.current = key;
    const finish = (next: GenerationState) => {
      if (!run.stopped) setState(next);
    };
    const settle = (generation: Generation) => {
      useAi.getState().setCredits(generation.credits);
    };

    void (async () => {
      try {
        const upload = resizeJpeg(new File(sourceUri).bytesSync(), UPLOAD_LONG_EDGE);
        let generation = await startGeneration(styleId, upload);
        run.id = generation.id;
        settle(generation);
        finish({ phase: 'running', id: generation.id });
        const startedAt = Date.now();
        while (generation.status === 'queued' || generation.status === 'processing') {
          if (run.stopped) return;
          if (Date.now() - startedAt > GIVE_UP_MS) throw new AiError('timeout', 'Gave up waiting');
          await sleep(POLL_MS);
          generation = await getGeneration(generation.id);
        }
        settle(generation);
        if (generation.status === 'succeeded' && generation.imageUrl !== null) {
          const file = new File(tempDirectory('ai'), `${generation.id}.jpg`);
          if (file.exists) file.delete();
          await File.downloadFileAsync(generation.imageUrl, file);
          track({ name: 'ai_generated', styleId });
          finish({ phase: 'done', id: generation.id, resultUri: file.uri });
        } else if (generation.status === 'cancelled') {
          finish({ phase: 'cancelled' });
        } else {
          finish({ phase: 'failed', code: generation.error ?? 'internal' });
        }
      } catch (error) {
        if (!(error instanceof AiError)) reportError(error, 'ai.generate');
        finish({ phase: 'failed', code: error instanceof AiError ? error.code : 'internal' });
      }
    })();

    return () => {
      run.stopped = true;
    };
  }, [sourceUri, styleId]);

  const cancel = async () => {
    const run = current.current;
    run.stopped = true;
    setState({ phase: 'cancelled' });
    if (run.id !== null) {
      try {
        useAi.getState().setCredits((await cancelGeneration(run.id)).credits);
      } catch (error) {
        reportError(error, 'ai.cancel');
      }
    }
  };

  return { state, cancel };
}
