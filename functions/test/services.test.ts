import { describe, expect, it } from 'vitest';

import { authenticate, createAccount, getCredits } from '../src/services/accounts';
import { ApiFailure } from '../src/services/errors';
import {
  cancelGeneration,
  createGeneration,
  deleteExpiredGenerations,
  getGeneration,
  processGeneration,
  reportGeneration,
  RETENTION_MS,
} from '../src/services/generations';
import { handleRevenueCatEvent } from '../src/services/webhooks';
import { JPEG_BASE64, SECRET, testDependencies } from './fakes';

const ADDRESS = '203.0.113.7';

async function expectFailure(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof ApiFailure && error.code === code,
  );
}

async function setup(overrides: Parameters<typeof testDependencies>[0] = {}) {
  const context = testDependencies(overrides);
  const { accountId } = await createAccount(context.deps, SECRET, ADDRESS);
  return { ...context, accountId, authorization: `Bearer ${accountId}.${SECRET}` };
}

describe('accounts', () => {
  it('gives new accounts three free credits (AI-07)', async () => {
    const { deps, accountId } = await setup();
    expect(await getCredits(deps, accountId)).toEqual({ total: 3, monthly: 0, purchased: 3 });
  });

  it('limits new accounts per network address', async () => {
    const { deps } = await setup();
    await createAccount(deps, SECRET, ADDRESS);
    await expectFailure(createAccount(deps, SECRET, ADDRESS), 'rate_limited');
    await expect(createAccount(deps, SECRET, '198.51.100.1')).resolves.toBeDefined();
  });

  it('authenticates only the matching secret', async () => {
    const { deps, accountId, authorization } = await setup();
    await expect(authenticate(deps, authorization)).resolves.toBe(accountId);
    await expectFailure(
      authenticate(deps, `Bearer ${accountId}.${'X'.repeat(43)}`),
      'unauthorized',
    );
    await expectFailure(authenticate(deps, undefined), 'unauthorized');
  });
});

describe('generations', () => {
  it('takes a credit, generates and keeps the result', async () => {
    const { deps, accountId, images } = await setup();
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    expect(queued).toMatchObject({ status: 'queued', credits: { total: 2 } });
    await processGeneration(deps, queued.id);
    const done = await getGeneration(deps, accountId, queued.id);
    expect(done).toMatchObject({ status: 'succeeded', error: null });
    expect(done.imageUrl).toMatch(/^https:/);
    expect(images.inputs.has(queued.id)).toBe(true);
  });

  it('rejects unknown styles and non-JPEG uploads', async () => {
    const { deps, accountId } = await setup();
    await expectFailure(
      createGeneration(deps, accountId, { styleId: 'nope', image: JPEG_BASE64 }),
      'bad_request',
    );
    await expectFailure(
      createGeneration(deps, accountId, { styleId: 'figure', image: 'aGVsbG8=' }),
      'bad_request',
    );
  });

  it('refuses without credits and leaves no upload behind', async () => {
    const { deps, accountId, images } = await setup();
    const { store } = deps;
    const account = await store.getAccount(accountId);
    if (account === null) throw new Error('missing account');
    await store.transaction((tx) => {
      tx.setAccount(accountId, { ...account, purchased: 0 });
      return Promise.resolve();
    });
    await expectFailure(
      createGeneration(deps, accountId, { styleId: 'figure', image: JPEG_BASE64 }),
      'insufficient_credits',
    );
    expect(images.inputs.size).toBe(0);
  });

  it('limits generations per hour', async () => {
    const { deps, accountId, store } = await setup();
    const account = await store.getAccount(accountId);
    if (account === null) throw new Error('missing account');
    await store.transaction((tx) => {
      tx.setAccount(accountId, { ...account, purchased: 10 });
      return Promise.resolve();
    });
    for (let i = 0; i < 3; i++)
      await createGeneration(deps, accountId, { styleId: 'figure', image: JPEG_BASE64 });
    await expectFailure(
      createGeneration(deps, accountId, { styleId: 'figure', image: JPEG_BASE64 }),
      'rate_limited',
    );
  });

  it.each([
    ['moderation_blocked', { moderator: { isAllowed: () => Promise.resolve(false) } }],
    ['unavailable', { generator: { generate: () => Promise.reject(new Error('provider down')) } }],
    [
      'timeout',
      {
        generator: {
          generate: (_: Uint8Array, __: string, signal: AbortSignal) =>
            new Promise<Uint8Array>((_resolve, reject) => {
              signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
              });
            }),
        },
      },
    ],
  ] as const)('fails with %s and refunds the credit', async (code, overrides) => {
    const { deps, accountId, images } = await setup(overrides);
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    await processGeneration(deps, queued.id);
    const failed = await getGeneration(deps, accountId, queued.id);
    expect(failed).toMatchObject({ status: 'failed', error: code, credits: { total: 3 } });
    expect(images.inputs.has(queued.id)).toBe(false);
  });

  it('cancels with a refund, and a finished job cannot be cancelled', async () => {
    const { deps, accountId } = await setup();
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    expect(await cancelGeneration(deps, accountId, queued.id)).toMatchObject({
      status: 'cancelled',
      credits: { total: 3 },
    });
    await processGeneration(deps, queued.id);
    expect((await getGeneration(deps, accountId, queued.id)).status).toBe('cancelled');
  });

  it("hides other accounts' jobs", async () => {
    const { deps, accountId } = await setup();
    const other = await createAccount(deps, SECRET, '198.51.100.9');
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    await expectFailure(getGeneration(deps, other.accountId, queued.id), 'not_found');
    await expectFailure(cancelGeneration(deps, other.accountId, queued.id), 'not_found');
  });

  it('records reports for review', async () => {
    const { deps, accountId, store, logs } = await setup();
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    await reportGeneration(deps, accountId, queued.id, 'not_me');
    expect((await store.getGeneration(queued.id))?.report).toBe('not_me');
    expect(logs.some(({ message }) => message === 'generation.reported')).toBe(true);
  });

  it('deletes jobs and images after the retention', async () => {
    let now = Date.parse('2026-11-15T00:00:00Z');
    const { deps, accountId, store, images } = await setup({ now: () => now });
    const queued = await createGeneration(deps, accountId, {
      styleId: 'figure',
      image: JPEG_BASE64,
    });
    await processGeneration(deps, queued.id);
    expect(await deleteExpiredGenerations(deps)).toBe(0);
    now += RETENTION_MS + 1;
    expect(await deleteExpiredGenerations(deps)).toBe(1);
    expect(store.generations.size).toBe(0);
    expect(images.outputs.size).toBe(0);
  });
});

describe('RevenueCat webhooks', () => {
  const purchase = (accountId: string, id = 'evt1') => ({
    event: { id, type: 'NON_RENEWING_PURCHASE', app_user_id: accountId, product_id: 'credits_30' },
  });

  it('adds purchased credit packs once per event', async () => {
    const { deps, accountId } = await setup();
    expect(await handleRevenueCatEvent(deps, purchase(accountId))).toBe('applied');
    expect(await handleRevenueCatEvent(deps, purchase(accountId))).toBe('ignored');
    expect((await getCredits(deps, accountId)).purchased).toBe(33);
  });

  it('takes refunded credit packs back, never below zero', async () => {
    const { deps, accountId } = await setup();
    await handleRevenueCatEvent(deps, purchase(accountId));
    const refund = { event: { ...purchase(accountId, 'evt-refund').event, type: 'CANCELLATION' } };
    expect(await handleRevenueCatEvent(deps, refund)).toBe('applied');
    expect((await getCredits(deps, accountId)).purchased).toBe(3);
    await handleRevenueCatEvent(deps, { event: { ...refund.event, id: 'evt-refund-2' } });
    expect((await getCredits(deps, accountId)).purchased).toBe(0);
  });

  it('ignores unknown packs, unknown users and malformed events', async () => {
    const { deps, accountId } = await setup();
    const odd = { event: { ...purchase(accountId).event, product_id: 'credits_9999' } };
    expect(await handleRevenueCatEvent(deps, odd)).toBe('ignored');
    expect(await handleRevenueCatEvent(deps, purchase('$RCAnonymousID:abc'))).toBe('ignored');
    expect(await handleRevenueCatEvent(deps, { nope: true })).toBe('ignored');
  });

  it('grants monthly credits while the annual plan is active, finding the account by alias', async () => {
    const { deps, accountId } = await setup();
    await handleRevenueCatEvent(deps, {
      event: {
        id: 'evt2',
        type: 'INITIAL_PURCHASE',
        app_user_id: '$RCAnonymousID:abc',
        aliases: [accountId],
        product_id: 'premium_annual',
        expiration_at_ms: Date.parse('2027-11-15T00:00:00Z'),
      },
    });
    expect(await getCredits(deps, accountId)).toEqual({ total: 13, monthly: 10, purchased: 3 });
  });

  it('ends monthly credits when the annual plan is refunded', async () => {
    const { deps, accountId } = await setup();
    const annual = (id: string, type: string, expiresAt: string) => ({
      event: {
        id,
        type,
        app_user_id: accountId,
        product_id: 'premium_annual',
        expiration_at_ms: Date.parse(expiresAt),
      },
    });
    await handleRevenueCatEvent(deps, annual('evt3', 'INITIAL_PURCHASE', '2027-11-15T00:00:00Z'));
    // A refund cancels with the refund time as the end.
    await handleRevenueCatEvent(deps, annual('evt4', 'CANCELLATION', '2020-01-01T00:00:00Z'));
    expect((await getCredits(deps, accountId)).monthly).toBe(0);
  });
});
