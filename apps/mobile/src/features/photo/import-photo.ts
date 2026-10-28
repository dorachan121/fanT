import { File } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { resizeJpeg } from '../../engine/photo';
import { createPhoto } from './photo-service';
import { neutralRecipe } from './recipe';
import type { AlbumPhoto } from '../album/album-types';

/** About a 16 MP photo; larger imports are scaled down to this long edge. */
const MAX_IMPORT_LONG_EDGE = 4096;

/** Asks the system photo picker for one image; `null` when the user cancels. */
export async function pickImageFile(): Promise<File | null> {
  // The system picker needs no library permission: only the chosen photo is shared.
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset === undefined ? null : new File(asset.uri);
}

/**
 * Brings a photo from the device into the album to edit (EDT-04). It starts
 * without a look so the user chooses one in the editor.
 */
export async function importPhoto(): Promise<AlbumPhoto | null> {
  const file = await pickImageFile();
  if (file === null) return null;
  return createPhoto({
    kind: 'import',
    // Very large images (panoramas, scans) would exceed what the device can render.
    original: resizeJpeg(await file.bytes(), MAX_IMPORT_LONG_EDGE),
    recipeFor: () => neutralRecipe(Math.random()),
  });
}
