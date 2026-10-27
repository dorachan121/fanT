import type { PhotoRecipe } from '../photo/recipe';

/** How a photo entered the album. */
export type PhotoKind = 'camera' | 'import' | 'puri' | 'ai';

export interface AlbumPhoto {
  readonly id: string;
  readonly kind: PhotoKind;
  readonly createdAt: number;
  /** Changes when the output is re-rendered; part of image cache keys. */
  readonly updatedAt: number;
  /** Size of the rendered output. */
  readonly width: number;
  readonly height: number;
  /** How to render it again from the original; `null` for composites (puri, AI). */
  readonly recipe: PhotoRecipe | null;
  /** The unprocessed original is kept (CAM-04) until `originalExpiresAt` (ALB-03). */
  readonly hasOriginal: boolean;
  readonly originalExpiresAt: number | null;
  readonly outputUri: string;
  readonly originalUri: string | null;
}
