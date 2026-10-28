import { fetchWithTimeout } from '../../lib/fetch-with-timeout';

/** A download that took too long or was too large; the caller keeps what it has. */
class DownloadError extends Error {
  override readonly name = 'DownloadError';
}

/**
 * Fetches JSON with a timeout and a size limit, so a slow or hostile server cannot
 * hang the app or exhaust its memory. The result is untrusted: validate it.
 */
export async function fetchJson(
  url: string,
  { timeoutMs, maxBytes, init }: { timeoutMs: number; maxBytes: number; init?: RequestInit },
): Promise<unknown> {
  const text = await fetchWithTimeout(url, init ?? {}, timeoutMs, async (response) => {
    if (!response.ok) throw new DownloadError(`HTTP ${String(response.status)} for ${url}`);
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > maxBytes) throw new DownloadError(`Response too large: ${url}`);
    return response.text();
  });
  if (text.length > maxBytes) throw new DownloadError(`Response too large: ${url}`);
  return JSON.parse(text) as unknown;
}
