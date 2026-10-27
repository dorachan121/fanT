import Storage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { AppState, Platform } from 'react-native';

import { APP_CONFIG } from '../../config';
import { toErrorEvent, type AnalyticsEvent } from './events';

const INSTALL_ID_KEY = 'analytics.installId';
const PENDING_KEY = 'analytics.pending';
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH = 50;
const MAX_PENDING = 200;

interface Envelope {
  readonly event: AnalyticsEvent;
  readonly at: number;
}

let queue: Envelope[] = [];
let started = false;

/** Anonymous per-install ID (SET-04); reset by reinstalling the app. */
function installId(): string {
  let id = Storage.getItemSync(INSTALL_ID_KEY);
  if (id === null) {
    id = randomUUID();
    Storage.setItemSync(INSTALL_ID_KEY, id);
  }
  return id;
}

/** Keeps unsent events across launches (a crash stops the app before it can send). */
function persistQueue(): void {
  Storage.setItemSync(PENDING_KEY, JSON.stringify(queue.slice(-MAX_PENDING)));
}

function restoreQueue(): void {
  try {
    const saved: unknown = JSON.parse(Storage.getItemSync(PENDING_KEY) ?? '[]');
    if (Array.isArray(saved)) queue = (saved as Envelope[]).slice(-MAX_PENDING);
  } catch {
    queue = [];
  }
}

async function flush(): Promise<void> {
  const { apiBaseUrl } = APP_CONFIG;
  if (apiBaseUrl === null || queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const response = await fetch(`${apiBaseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installId: installId(),
        platform: Platform.OS,
        appVersion: APP_CONFIG.appVersion,
        events: batch,
      }),
    });
    if (response.ok) {
      queue = queue.slice(batch.length);
      persistQueue();
    }
  } catch {
    // Offline: the events stay queued for the next flush.
  }
}

/** Records an event; sent in batches (ANL-01). */
export function track(event: AnalyticsEvent): void {
  if (__DEV__) console.info('[analytics]', event);
  queue.push({ event, at: Date.now() });
  if (queue.length > MAX_PENDING) queue = queue.slice(-MAX_PENDING);
  persistQueue();
}

/** Reports a handled error (ANL-02); never throws. */
export function reportError(error: unknown, context: string): void {
  if (__DEV__) console.warn(`[${context}]`, error);
  try {
    track(toErrorEvent(error, context, false));
  } catch {
    // Reporting must never cause another failure.
  }
}

/**
 * Starts batching and installs a handler that records fatal JS errors before the
 * default handler shows or ends the app (ANL-02). Call once at startup.
 */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  restoreQueue();
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    try {
      track(toErrorEvent(error, 'global', isFatal === true));
    } finally {
      previous(error, isFatal);
    }
  });
  setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void flush();
  });
  track({ name: 'app_open' });
  void flush();
}
