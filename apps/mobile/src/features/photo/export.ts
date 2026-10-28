import { File } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import { shareAsync } from 'expo-sharing';

import { reportError } from '../analytics/analytics';
import { resizeJpeg } from '../../engine/photo';
import { tempDirectory } from '../../lib/temp-files';

/** The device album photos are saved into (SHR-01). */
const DEVICE_ALBUM = 'fanT';
/** Long edge of "for social media" exports (SHR-04). */
const SNS_LONG_EDGE = 2048;

export class PhotoLibraryPermissionError extends Error {
  override readonly name = 'PhotoLibraryPermissionError';
}

export type ExportSize = 'full' | 'sns';

/** Writes the photo to a temporary file of the chosen size; the caller deletes it. */
function exportFile(source: File, size: ExportSize): File {
  const file = new File(tempDirectory('export'), `fant-${String(Date.now())}.jpg`);
  const bytes = source.bytesSync();
  file.writeSync(size === 'sns' ? resizeJpeg(bytes, SNS_LONG_EDGE) : bytes);
  return file;
}

/**
 * Saves a photo to the device library, in the app's own album when the system
 * allows it (SHR-01). Asks only for add-only access: the app never reads the
 * user's photos. Never adds a watermark, and the file carries no location (SHR-05).
 */
export async function saveToLibrary(source: File, size: ExportSize): Promise<void> {
  const { granted } = await requestPermissionsAsync(true);
  if (!granted) throw new PhotoLibraryPermissionError('Photo library access was not granted');
  const file = exportFile(source, size);
  try {
    try {
      const album = await Album.get(DEVICE_ALBUM);
      if (album === null) {
        const asset = await Asset.create(file.uri);
        await Album.create(DEVICE_ALBUM, [asset]);
      } else {
        await Asset.create(file.uri, album);
      }
    } catch (error) {
      // Add-only access may not allow albums: save to the library itself instead.
      reportError(error, 'library.album');
      await Asset.create(file.uri);
    }
  } finally {
    file.delete();
  }
}

/** Opens the system share sheet with the photo (SHR-02). */
export async function sharePhoto(source: File, size: ExportSize): Promise<void> {
  const file = exportFile(source, size);
  try {
    await shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  } finally {
    file.delete();
  }
}
