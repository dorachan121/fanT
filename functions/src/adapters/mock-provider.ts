import type { ImageGenerator, Moderator } from '../ports';

/**
 * Stand-ins until the image generation provider is chosen (Q-04): the "generated"
 * image is the upload itself and moderation allows everything. Only for the
 * emulator and staging: production refuses to start with them (see `index.ts`).
 */
export const echoGenerator: ImageGenerator = {
  generate: (image) => Promise.resolve(image),
};

export const allowAllModerator: Moderator = {
  isAllowed: () => Promise.resolve(true),
};
