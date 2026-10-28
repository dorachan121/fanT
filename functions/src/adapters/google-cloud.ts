import { z } from 'zod';

import { ContentBlockedError, type ImageGenerator, type Moderator } from '../ports';

/** `fetch`, injectable for tests. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** An OAuth access token for Google Cloud APIs. */
export type TokenSource = (signal: AbortSignal) => Promise<string>;

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });

/**
 * The function's own service account token from the metadata server, cached until
 * shortly before it expires. No key file or secret is involved.
 */
export function metadataTokenSource(fetchFn: Fetch = fetch): TokenSource {
  let cached: { token: string; until: number } | null = null;
  return async (signal) => {
    if (cached !== null && Date.now() < cached.until) return cached.token;
    const response = await fetchFn(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal,
    });
    if (!response.ok) throw new Error(`Metadata token: HTTP ${String(response.status)}`);
    const { access_token: token, expires_in: expiresIn } = tokenSchema.parse(await response.json());
    cached = { token, until: Date.now() + (expiresIn - 60) * 1000 };
    return token;
  };
}

async function postJson(
  fetchFn: Fetch,
  token: TokenSource,
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token(signal)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  // Error bodies may echo the request; only the status is reported.
  if (!response.ok) throw new Error(`${new URL(url).host}: HTTP ${String(response.status)}`);
  return response.json();
}

const geminiResponseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z
              .array(
                z.object({
                  inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/** Finish reasons that mean the model's safety filters stopped it. */
const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
]);

/**
 * Image-to-image generation with a Gemini image model on Vertex AI (Q-04). Runs in
 * the project's own Google Cloud, so photos stay within it and are not used for
 * training (Vertex AI data governance).
 */
export class GeminiImageGenerator implements ImageGenerator {
  constructor(
    private readonly options: {
      readonly project: string;
      readonly model: string;
      readonly token: TokenSource;
      readonly fetch?: Fetch;
    },
  ) {}

  async generate(image: Uint8Array, prompt: string, signal: AbortSignal): Promise<Uint8Array> {
    const { project, model, token } = this.options;
    const url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const json = await postJson(
      this.options.fetch ?? fetch,
      token,
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: { mimeType: 'image/jpeg', data: Buffer.from(image).toString('base64') },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'], candidateCount: 1 },
      },
      signal,
    );
    const parsed = geminiResponseSchema.parse(json);
    if (parsed.promptFeedback?.blockReason !== undefined)
      throw new ContentBlockedError(`Prompt blocked: ${parsed.promptFeedback.blockReason}`);
    const candidate = parsed.candidates?.[0];
    const data = candidate?.content?.parts?.find(
      (part) => part.inlineData?.mimeType.startsWith('image/') === true,
    )?.inlineData?.data;
    if (data !== undefined) return new Uint8Array(Buffer.from(data, 'base64'));
    if (BLOCKED_FINISH_REASONS.has(candidate?.finishReason ?? ''))
      throw new ContentBlockedError(`Result blocked: ${candidate?.finishReason ?? ''}`);
    throw new Error(`No image in the response (${candidate?.finishReason ?? 'no candidate'})`);
  }
}

const LIKELIHOODS = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
] as const;
const likelihoodSchema = z.enum(LIKELIHOODS).catch('UNKNOWN');
const safeSearchResponseSchema = z.object({
  responses: z
    .array(
      z.object({
        safeSearchAnnotation: z
          .object({
            adult: likelihoodSchema,
            violence: likelihoodSchema,
            racy: likelihoodSchema,
          })
          .optional(),
        error: z.object({ message: z.string().optional() }).optional(),
      }),
    )
    .length(1),
});

/** Teen audience (01 §3): anything likely to be adult, racy or violent is refused. */
const BLOCK_FROM = LIKELIHOODS.indexOf('LIKELY');

/** Moderation with Cloud Vision SafeSearch (AI-05), for both uploads and results. */
export class SafeSearchModerator implements Moderator {
  constructor(private readonly options: { readonly token: TokenSource; readonly fetch?: Fetch }) {}

  async isAllowed(image: Uint8Array, signal: AbortSignal): Promise<boolean> {
    const json = await postJson(
      this.options.fetch ?? fetch,
      this.options.token,
      'https://vision.googleapis.com/v1/images:annotate',
      {
        requests: [
          {
            image: { content: Buffer.from(image).toString('base64') },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          },
        ],
      },
      signal,
    );
    const [result] = safeSearchResponseSchema.parse(json).responses;
    // An image Vision could not judge is not let through.
    if (result?.error !== undefined || result?.safeSearchAnnotation === undefined) {
      throw new Error(`SafeSearch failed: ${result?.error?.message ?? 'no annotation'}`);
    }
    const { adult, violence, racy } = result.safeSearchAnnotation;
    return [adult, violence, racy].every((value) => LIKELIHOODS.indexOf(value) < BLOCK_FROM);
  }
}
