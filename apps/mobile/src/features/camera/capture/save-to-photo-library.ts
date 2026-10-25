import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

export class PhotoLibraryPermissionError extends Error {
  override readonly name = 'PhotoLibraryPermissionError';
}

/**
 * Saves a JPEG to the device photo library. Requests add-only access: the app
 * never needs to read the user's existing photos.
 */
export async function saveToPhotoLibrary(jpeg: Uint8Array): Promise<void> {
  const { granted } = await requestPermissionsAsync(true);
  if (!granted) throw new PhotoLibraryPermissionError('Photo library access was not granted');

  const file = new File(Paths.cache, `fant-${String(Date.now())}.jpg`);
  await file.write(jpeg);
  try {
    await Asset.create(file.uri);
  } finally {
    file.delete();
  }
}
