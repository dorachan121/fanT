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
  chibi: {
    credits: 1,
    prompt:
      'Redraw the person as a cute chibi character with a big head, small body and sparkling eyes, in clean bright colors. Keep their hairstyle, outfit colors and expression recognizable.',
  },
  clay: {
    credits: 1,
    prompt:
      'Turn the person into a rounded handmade clay doll with soft fingerprint texture, pastel background and soft light. Keep their hairstyle, outfit and expression recognizable.',
  },
  pixel_art: {
    credits: 1,
    prompt:
      'Redraw the photo as retro video game pixel art with a limited bright palette and crisp square pixels. Keep the person recognizable.',
  },
  pop_art: {
    credits: 1,
    prompt:
      'Turn the photo into colorful pop art with bold outlines, halftone dots and flat vivid colors, not copying any specific artist. Keep the person recognizable.',
  },
  // Scenery (AI-12): the sky or the season of a landscape, people left as they are.
  sky_blue: {
    credits: 1,
    prompt:
      'Replace only the sky in the photo with a clear bright blue sky with a few soft white clouds, lit to match the scene. Keep everything that is not sky (buildings, trees, landscape, people) exactly as it is, at the same framing. If there is no visible sky, return the photo unchanged.',
  },
  sky_sunset: {
    credits: 1,
    prompt:
      'Replace only the sky in the photo with a vivid orange and pink sunset sky, and add warm golden-hour light to the rest of the scene to match it. Keep the buildings, landscape and people in place and recognizable, at the same framing.',
  },
  sky_starry: {
    credits: 1,
    prompt:
      'Turn the photo into a night scene: replace the sky with a deep blue night sky full of stars and a faint Milky Way, and darken the rest of the scene to moonlight. Keep the buildings, landscape and people in place and recognizable, at the same framing.',
  },
  snow_scene: {
    credits: 1,
    prompt:
      'Turn the scene into a winter day: soft fresh snow on the ground, roofs and branches, a few falling snowflakes and cool soft light. Keep the buildings, landscape and people in place and recognizable, at the same framing.',
  },
  night_lights: {
    credits: 1,
    prompt:
      'Turn the photo into a night view: dark blue evening sky, warm glowing windows, street lights and soft reflections, as if taken just after sunset. Keep the buildings, landscape and people in place and recognizable, at the same framing.',
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
