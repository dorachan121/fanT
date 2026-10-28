/**
 * AI styles the server can generate (AI-02). The app shows the same IDs and prices
 * from the content manifest; prompts never leave the server. Style names avoid
 * specific works and artists (AI-02). A test keeps this in sync with content/.
 */
import { AI_TOOLS } from '@fant/api-types';

export interface StyleDefinition {
  readonly credits: number;
  readonly prompt: string;
}

/** How a job is done: a style prompt, erasing a masked area (AI-10) or upscaling (AI-11). */
export type JobKind = 'style' | 'erase' | 'upscale';

export interface JobDefinition {
  readonly kind: JobKind;
  readonly credits: number;
  /** For the generator; unused by upscaling. */
  readonly prompt: string;
}

/** The erase tool's instruction; the mask comes as a second image. */
export const ERASE_PROMPT =
  'The second image is a mask. Remove everything under its white area from the first image and fill that area in naturally to match the surroundings. Keep everything else exactly as it is, at the same framing.';

export const STYLES: Readonly<Record<string, StyleDefinition>> = {
  figure: {
    credits: 1,
    prompt:
      'Turn the person in the photo into a small collectible figurine on a desk, glossy painted plastic, soft studio light. Keep their face, hair and outfit recognizable.',
  },
  illustration: {
    credits: 1,
    prompt:
      'Redraw the photo as a soft hand-drawn illustration with clean lines and gentle watercolor shading. Keep the person recognizable.',
  },
  heisei_puri: {
    credits: 1,
    prompt:
      'Make the photo look like a 2000s Japanese photo-booth sticker: bright skin, sparkles, pastel frame and handwritten doodles. Keep the person recognizable.',
  },
  retro_magazine: {
    credits: 1,
    prompt:
      'Turn the photo into a 1990s fashion magazine cover with film grain, bold masthead area and stylish layout, without any real magazine name. Keep the person recognizable.',
  },
};

/** Common instructions for every style: safety and consent (AI-05). */
export const SAFETY_PROMPT =
  'Do not add nudity, violence, weapons, real brand logos or text naming real people. Keep the result appropriate for teenagers.';

/** What a style or tool ID asks for, or `undefined` when it is unknown. */
export function jobFor(styleId: string): JobDefinition | undefined {
  if (styleId === 'erase')
    return { kind: 'erase', credits: AI_TOOLS.erase.credits, prompt: ERASE_PROMPT };
  if (styleId === 'upscale')
    return { kind: 'upscale', credits: AI_TOOLS.upscale.credits, prompt: '' };
  const style = STYLES[styleId];
  return style === undefined ? undefined : { kind: 'style', ...style };
}
