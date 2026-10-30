import { UPLOAD_LONG_EDGE } from '@fant/api-types';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

import { resizeJpeg } from '../../engine/photo';
import { downloadFile } from '../../lib/download-file';
import { sleep } from '../../lib/sleep';
import { tempDirectory } from '../../lib/temp-files';
import { reportError, track } from '../analytics/analytics';
import { cancelGeneration, getGeneration, startGeneration } from './ai-client';
import { useAi } from './ai-store';
import { GenerationRun, type GenerationState } from './generation-run';

export type { GenerationState } from './generation-run';

const DOWNLOAD_TIMEOUT_MS = 30_000;
/** Results are a single JPEG of a few megabytes at most. */
const MAX_RESULT_BYTES = 15 * 1024 * 1024;

/**
 * Runs one generation (S-43): uploads a downscaled copy (nothing larger leaves the
 * device) and, for erasing, the mask, polls until it ends, then downloads the result.
 * Cancelling refunds the credit on the server.
 */
export function useGeneration(sourceUri: string, styleId: string, maskUri: string | null) {
  const [state, setState] = useState<GenerationState>({ phase: 'running', id: null });
  const current = useRef<{ key: string; run: GenerationRun } | null>(null);

  useEffect(() => {
    // Start once per photo and style: a remount (e.g. React strict mode) must not
    // start, and pay for, a second generation.
    const key = `${styleId}|${sourceUri}|${maskUri ?? ''}`;
    if (current.current?.key === key) {
      const { run } = current.current;
      run.attach();
      return () => {
        run.detach();
      };
    }
    const run = new GenerationRun(
      {
        start: () => {
          const upload = resizeJpeg(new File(sourceUri).bytesSync(), UPLOAD_LONG_EDGE);
          const mask = maskUri === null ? undefined : new File(maskUri).bytesSync();
          return startGeneration(styleId, upload, mask);
        },
        get: getGeneration,
        cancel: cancelGeneration,
        download: async (id, imageUrl) => {
          const file = new File(tempDirectory('ai'), `${id}.jpg`);
          await downloadFile(imageUrl, file, {
            timeoutMs: DOWNLOAD_TIMEOUT_MS,
            maxBytes: MAX_RESULT_BYTES,
          });
          return file.uri;
        },
        setCredits: (credits) => {
          useAi.getState().setCredits(credits);
        },
        onSucceeded: () => {
          track({ name: 'ai_generated', styleId });
        },
        reportError,
        sleep,
        now: Date.now,
      },
      setState,
    );
    current.current = { key, run };
    void run.run();
    return () => {
      run.detach();
    };
  }, [sourceUri, styleId, maskUri]);

  const cancel = () => current.current?.run.cancel() ?? Promise.resolve();

  return { state, cancel };
}
