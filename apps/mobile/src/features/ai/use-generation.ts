import { UPLOAD_LONG_EDGE, type ApiErrorCode, type Generation } from '@fant/api-types';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

import { resizeJpeg } from '../../engine/photo';
import { DownloadError, downloadFile } from '../../lib/download-file';
import { sleep } from '../../lib/sleep';
import { tempDirectory } from '../../lib/temp-files';
import { reportError, track } from '../analytics/analytics';
import { AiError, cancelGeneration, getGeneration, startGeneration } from './ai-client';
import { useAi } from './ai-store';

const POLL_MS = 2000;
/** The server times out at 60 s and refunds; the app stops waiting a little later. */
const GIVE_UP_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** Results are a single JPEG of a few megabytes at most. */
const MAX_RESULT_BYTES = 15 * 1024 * 1024;

/**
 * One status check. A dropped connection keeps the last known state, so a short
 * network blip does not end a generation that is still running (and paid for).
 */
async function pollOnce(last: Generation): Promise<Generation> {
  try {
    return await getGeneration(last.id);
  } catch (error) {
    if (error instanceof AiError && error.code === 'offline') return last;
    throw error;
  }
}

/** What to tell the user about an error that ended a generation. */
function failureCode(error: unknown): ApiErrorCode | 'offline' {
  if (error instanceof AiError) return error.code;
  if (error instanceof DownloadError) return 'offline';
  reportError(error, 'ai.generate');
  return 'internal';
}

export type GenerationState =
  | { readonly phase: 'running'; readonly id: string | null }
  | { readonly phase: 'done'; readonly id: string; readonly resultUri: string }
  | { readonly phase: 'failed'; readonly code: ApiErrorCode | 'offline' }
  | { readonly phase: 'cancelled' };

/**
 * Runs one generation (S-43): uploads a downscaled copy (nothing larger leaves the
 * device) and, for erasing, the mask, polls until it ends, then downloads the result. Cancelling refunds the
 * credit on the server.
 */
export function useGeneration(sourceUri: string, styleId: string, maskUri: string | null) {
  const [state, setState] = useState<GenerationState>({ phase: 'running', id: null });
  const current = useRef<{ id: string | null; stopped: boolean }>({ id: null, stopped: false });
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    const run = current.current;
    run.stopped = false;
    // Start once per photo and style: a remount (e.g. React strict mode) must not
    // start, and pay for, a second generation.
    const key = `${styleId}|${sourceUri}|${maskUri ?? ''}`;
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
        const mask = maskUri === null ? undefined : new File(maskUri).bytesSync();
        let generation = await startGeneration(styleId, upload, mask);
        run.id = generation.id;
        settle(generation);
        finish({ phase: 'running', id: generation.id });
        const startedAt = Date.now();
        while (generation.status === 'queued' || generation.status === 'processing') {
          if (run.stopped) return;
          if (Date.now() - startedAt > GIVE_UP_MS) throw new AiError('timeout', 'Gave up waiting');
          await sleep(POLL_MS);
          generation = await pollOnce(generation);
        }
        settle(generation);
        if (generation.status === 'succeeded' && generation.imageUrl !== null) {
          const file = new File(tempDirectory('ai'), `${generation.id}.jpg`);
          await downloadFile(generation.imageUrl, file, {
            timeoutMs: DOWNLOAD_TIMEOUT_MS,
            maxBytes: MAX_RESULT_BYTES,
          });
          track({ name: 'ai_generated', styleId });
          finish({ phase: 'done', id: generation.id, resultUri: file.uri });
        } else if (generation.status === 'cancelled') {
          finish({ phase: 'cancelled' });
        } else {
          finish({ phase: 'failed', code: generation.error ?? 'internal' });
        }
      } catch (error) {
        finish({ phase: 'failed', code: failureCode(error) });
      }
    })();

    return () => {
      run.stopped = true;
    };
  }, [sourceUri, styleId, maskUri]);

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
