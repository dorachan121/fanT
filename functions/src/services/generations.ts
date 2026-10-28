import {
  MAX_UPLOAD_BYTES,
  type ApiErrorCode,
  type Generation,
  type ReportReason,
} from '@fant/api-types';

import { creditsOf, debit, InsufficientCreditsError, refund } from '../domain/credits';
import { takeRate } from '../domain/rate-limit';
import { newId } from '../domain/secrets';
import { SAFETY_PROMPT, STYLES } from '../domain/styles';
import type { Dependencies, GenerationRecord, Transaction } from '../ports';
import { ApiFailure } from './errors';

const HOUR_MS = 60 * 60 * 1000;
/** Results and uploads are deleted within this time (03 §6). */
export const RETENTION_MS = 24 * HOUR_MS;

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function view(
  deps: Dependencies,
  id: string,
  generation: GenerationRecord,
): Promise<Generation> {
  const account = await deps.store.getAccount(generation.accountId);
  return {
    id,
    status: generation.status,
    imageUrl: generation.status === 'succeeded' ? await deps.images.outputUrl(id) : null,
    error: generation.error,
    credits:
      account === null
        ? { total: 0, monthly: 0, purchased: 0 }
        : creditsOf(account, deps.now(), deps.settings.monthlyCredits),
  };
}

/**
 * Starts a generation (AI-04): checks the style and the upload, limits the rate,
 * takes the credits and queues the job, all or nothing. The upload is stored first
 * and deleted again if the job cannot start.
 */
export async function createGeneration(
  deps: Dependencies,
  accountId: string,
  request: { readonly styleId: string; readonly image: string },
): Promise<Generation> {
  const style = STYLES[request.styleId];
  if (style === undefined) throw new ApiFailure('bad_request', 'Unknown style');
  const bytes = Buffer.from(request.image, 'base64');
  if (bytes.length > MAX_UPLOAD_BYTES || !isJpeg(bytes))
    throw new ApiFailure('bad_request', 'Expected a JPEG photo');

  const id = newId();
  const now = deps.now();
  await deps.images.putInput(id, bytes);
  try {
    await deps.store.transaction(async (tx) => {
      const account = await tx.getAccount(accountId);
      if (account === null) throw new ApiFailure('unauthorized', 'Unknown account');
      const rate = takeRate(account.rate, now, deps.settings.generationsPerHour, HOUR_MS);
      if (rate === null)
        throw new ApiFailure('rate_limited', 'Too many generations; try again later');
      let taken: ReturnType<typeof debit>;
      try {
        taken = debit(account, style.credits, now, deps.settings.monthlyCredits);
      } catch (error) {
        if (error instanceof InsufficientCreditsError)
          throw new ApiFailure('insufficient_credits', 'Not enough credits');
        throw error;
      }
      tx.setAccount(accountId, { ...account, ...taken.account, rate });
      tx.setGeneration(id, {
        accountId,
        styleId: request.styleId,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        debit: taken.debit,
        error: null,
        report: null,
      });
    });
  } catch (error) {
    await deps.images.deleteImages(id);
    throw error;
  }
  deps.logger.info('generation.queued', { id, accountId, styleId: request.styleId });
  const created = await deps.store.getGeneration(id);
  if (created === null) throw new ApiFailure('internal', 'Generation was not saved');
  return view(deps, id, created);
}

/** Ends a job as failed and gives its credits back, unless it already ended. */
async function finishWithRefund(
  tx: Transaction,
  id: string,
  status: 'failed' | 'cancelled',
  error: ApiErrorCode | null,
  now: number,
) {
  const generation = await tx.getGeneration(id);
  if (generation === null || (generation.status !== 'queued' && generation.status !== 'processing'))
    return false;
  const account = await tx.getAccount(generation.accountId);
  if (account !== null)
    tx.setAccount(generation.accountId, { ...account, ...refund(account, generation.debit) });
  tx.setGeneration(id, { ...generation, status, error, updatedAt: now });
  return true;
}

function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, ms);
  return work(controller.signal).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Runs a queued job (triggered when it is created): moderates the upload, generates,
 * moderates the result and stores it. Any failure refunds the credits; the upload is
 * deleted as soon as it is no longer needed (03 §6).
 */
export async function processGeneration(deps: Dependencies, id: string): Promise<void> {
  const started = await deps.store.transaction(async (tx) => {
    const generation = await tx.getGeneration(id);
    if (generation?.status !== 'queued') return null;
    tx.setGeneration(id, { ...generation, status: 'processing', updatedAt: deps.now() });
    return generation;
  });
  if (started === null) return;
  const style = STYLES[started.styleId];

  const fail = async (error: ApiErrorCode) => {
    await deps.store.transaction((tx) => finishWithRefund(tx, id, 'failed', error, deps.now()));
    await deps.images.deleteImages(id);
    deps.logger.warn('generation.failed', { id, error });
  };

  try {
    if (style === undefined) {
      await fail('bad_request');
      return;
    }
    const input = await deps.images.getInput(id);
    const timeoutMs = deps.settings.generationTimeoutMs;
    const output = await withTimeout(async (signal) => {
      if (!(await deps.moderator.isAllowed(input, signal))) return 'blocked' as const;
      const generated = await deps.generator.generate(
        input,
        `${style.prompt}\n${SAFETY_PROMPT}`,
        signal,
      );
      return (await deps.moderator.isAllowed(generated, signal)) ? generated : ('blocked' as const);
    }, timeoutMs).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return 'timeout' as const;
      throw error;
    });
    if (output === 'blocked') {
      await fail('moderation_blocked');
      return;
    }
    if (output === 'timeout') {
      await fail('timeout');
      return;
    }
    await deps.images.putOutput(id, output);
    const succeeded = await deps.store.transaction(async (tx) => {
      const generation = await tx.getGeneration(id);
      // Cancelled meanwhile: the credits were already refunded; drop the result.
      if (generation?.status !== 'processing') return false;
      tx.setGeneration(id, { ...generation, status: 'succeeded', updatedAt: deps.now() });
      return true;
    });
    if (!succeeded) await deps.images.deleteImages(id);
    deps.logger.info('generation.finished', { id, succeeded });
  } catch (error) {
    deps.logger.error('generation.error', {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    await fail('unavailable');
  }
}

async function owned(deps: Dependencies, accountId: string, id: string): Promise<GenerationRecord> {
  const generation = await deps.store.getGeneration(id);
  // Someone else's job looks exactly like a missing one.
  if (generation?.accountId !== accountId)
    throw new ApiFailure('not_found', 'Generation not found');
  return generation;
}

export async function getGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
): Promise<Generation> {
  return view(deps, id, await owned(deps, accountId, id));
}

/** Cancels a job that has not finished and refunds it (S-43). */
export async function cancelGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
): Promise<Generation> {
  await owned(deps, accountId, id);
  const cancelled = await deps.store.transaction((tx) =>
    finishWithRefund(tx, id, 'cancelled', null, deps.now()),
  );
  if (cancelled) await deps.images.deleteImages(id);
  return getGeneration(deps, accountId, id);
}

/** Records a report of an inappropriate result for review (AI-05). */
export async function reportGeneration(
  deps: Dependencies,
  accountId: string,
  id: string,
  reason: ReportReason,
): Promise<void> {
  await owned(deps, accountId, id);
  await deps.store.transaction(async (tx) => {
    const generation = await tx.getGeneration(id);
    if (generation !== null)
      tx.setGeneration(id, { ...generation, report: reason, updatedAt: deps.now() });
  });
  deps.logger.warn('generation.reported', {
    id,
    styleId: (await deps.store.getGeneration(id))?.styleId,
    reason,
  });
}

const DELETE_BATCH = 500;
/** Keeps one run well inside the scheduler's time limit; the next run continues. */
const MAX_DELETE_BATCHES = 10;

/** Deletes jobs, uploads and results older than the retention (03 §6). */
export async function deleteExpiredGenerations(deps: Dependencies): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_DELETE_BATCHES; batch++) {
    const ids = await deps.store.listGenerationsBefore(deps.now() - RETENTION_MS, DELETE_BATCH);
    for (const id of ids) {
      await deps.images.deleteImages(id);
      await deps.store.deleteGeneration(id);
    }
    deleted += ids.length;
    if (ids.length < DELETE_BATCH) break;
  }
  return deleted;
}
