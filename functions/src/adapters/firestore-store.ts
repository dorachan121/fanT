import type { Firestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore';

import type { RateWindow } from '../domain/rate-limit';
import type { AccountRecord, GenerationRecord, Store, Transaction } from '../ports';

/**
 * The store on Firestore: `accounts`, `generations` (each with an `expireAt` for a
 * TTL policy as a second safety net), `rates` and applied `webhookEvents`.
 */
export class FirestoreStore implements Store {
  constructor(private readonly db: Firestore) {}

  private account(id: string) {
    return this.db.collection('accounts').doc(id);
  }

  private generation(id: string) {
    return this.db.collection('generations').doc(id);
  }

  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (firestoreTx: FirestoreTransaction) => {
      const tx: Transaction = {
        getAccount: async (id) =>
          ((await firestoreTx.get(this.account(id))).data() as AccountRecord | undefined) ?? null,
        setAccount: (id, account) => {
          firestoreTx.set(this.account(id), account);
        },
        getGeneration: async (id) =>
          ((await firestoreTx.get(this.generation(id))).data() as GenerationRecord | undefined) ??
          null,
        setGeneration: (id, generation) => {
          firestoreTx.set(this.generation(id), {
            ...generation,
            expireAt: new Date(generation.createdAt + 2 * 24 * 3600 * 1000),
          });
        },
        getRate: async (key) =>
          ((await firestoreTx.get(this.db.collection('rates').doc(key))).data() as
            RateWindow | undefined) ?? null,
        setRate: (key, window) => {
          firestoreTx.set(this.db.collection('rates').doc(key), window);
        },
        claimEvent: async (id) => {
          const ref = this.db.collection('webhookEvents').doc(id);
          if ((await firestoreTx.get(ref)).exists) return false;
          firestoreTx.set(ref, { appliedAt: Date.now() });
          return true;
        },
      };
      return work(tx);
    });
  }

  async getAccount(id: string): Promise<AccountRecord | null> {
    return ((await this.account(id).get()).data() as AccountRecord | undefined) ?? null;
  }

  async getGeneration(id: string): Promise<GenerationRecord | null> {
    return ((await this.generation(id).get()).data() as GenerationRecord | undefined) ?? null;
  }

  async listGenerationsBefore(time: number, limit: number): Promise<string[]> {
    const snapshot = await this.db
      .collection('generations')
      .where('createdAt', '<', time)
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }

  async deleteGeneration(id: string): Promise<void> {
    await this.generation(id).delete();
  }
}
