import { z } from 'zod';

import { grantPurchased } from '../domain/credits';
import type { Dependencies } from '../ports';

/** The RevenueCat webhook fields this server reads. */
const eventSchema = z.object({
  event: z.object({
    id: z.string().min(1),
    type: z.string(),
    app_user_id: z.string(),
    aliases: z.array(z.string()).optional(),
    product_id: z.string().optional(),
    expiration_at_ms: z.number().nullable().optional(),
  }),
});

/** Credit packs on sale (04 §3); any other amount is a misconfiguration and grants nothing. */
const CREDIT_PACKS: ReadonlySet<number> = new Set([10, 30, 100]);
const SUBSCRIPTION_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'EXPIRATION',
]);

function creditsInProduct(productId: string | undefined): number | null {
  const amount = Number(/credits_(\d+)/.exec(productId ?? '')?.[1]);
  return CREDIT_PACKS.has(amount) ? amount : null;
}

/**
 * Applies a purchase from RevenueCat (PAY-03/06): credit packs add credits, the
 * annual plan grants monthly credits until it expires. Each event applies once,
 * even when RevenueCat retries it.
 */
export async function handleRevenueCatEvent(
  deps: Dependencies,
  body: unknown,
): Promise<'applied' | 'ignored'> {
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return 'ignored';
  const { event } = parsed.data;
  const candidates = [event.app_user_id, ...(event.aliases ?? [])].filter((id) =>
    /^[a-z0-9]{20,40}$/.test(id),
  );
  const credits =
    event.type === 'NON_RENEWING_PURCHASE' ? creditsInProduct(event.product_id) : null;
  const annual = SUBSCRIPTION_EVENTS.has(event.type) && (event.product_id ?? '').includes('annual');
  if (credits === null && !annual) return 'ignored';

  const applied = await deps.store.transaction(async (tx) => {
    for (const accountId of candidates) {
      const account = await tx.getAccount(accountId);
      if (account === null) continue;
      if (!(await tx.claimEvent(event.id))) return false;
      tx.setAccount(accountId, {
        ...account,
        ...(credits === null ? {} : grantPurchased(account, credits)),
        ...(annual ? { subscriberUntil: event.expiration_at_ms ?? null } : {}),
      });
      return true;
    }
    return false;
  });
  deps.logger.info('revenuecat.event', { id: event.id, type: event.type, applied });
  return applied ? 'applied' : 'ignored';
}
