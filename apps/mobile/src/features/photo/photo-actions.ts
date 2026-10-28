import { File } from 'expo-file-system';
import * as StoreReview from 'expo-store-review';

import { strings } from '../../i18n';
import { showError } from '../../ui/dialogs';
import { reportError, track } from '../analytics/analytics';
import type { AlbumPhoto } from '../album/album-types';
import { useSettings, type ExportSize } from '../settings/settings-store';
import { PhotoLibraryPermissionError, saveToLibrary, sharePhoto } from './export';

/** Asks for a store review after this many saves (ANL-04): a moment the user is happy. */
const REVIEW_AFTER_SAVES = 5;

async function maybeRequestReview(savedCount: number): Promise<void> {
  const { reviewRequested, update } = useSettings.getState();
  if (reviewRequested || savedCount < REVIEW_AFTER_SAVES) return;
  if (await StoreReview.hasAction()) {
    update({ reviewRequested: true });
    await StoreReview.requestReview();
  }
}

/**
 * Saves a file to the device library (SHR-01/04), explaining a refused permission
 * or any other failure to the user; returns whether it worked.
 */
export async function saveFileToLibrary(file: File, size: ExportSize): Promise<boolean> {
  try {
    await saveToLibrary(file, size);
    return true;
  } catch (error) {
    if (error instanceof PhotoLibraryPermissionError) {
      showError(strings.photo.libraryDenied);
    } else {
      reportError(error, 'photo.save');
      showError();
    }
    return false;
  }
}

/** Saves an album photo at the chosen size and counts it towards the review prompt. */
export async function savePhoto(photo: AlbumPhoto): Promise<boolean> {
  const { saveSize, savedCount, update } = useSettings.getState();
  if (!(await saveFileToLibrary(new File(photo.outputUri), saveSize))) return false;
  track({ name: 'photo_saved', kind: photo.kind });
  update({ savedCount: savedCount + 1 });
  void maybeRequestReview(savedCount + 1).catch((error: unknown) => {
    reportError(error, 'review.request');
  });
  return true;
}

/** Opens the share sheet (SHR-02). */
export async function sharePhotoFile(photo: AlbumPhoto): Promise<void> {
  try {
    await sharePhoto(new File(photo.outputUri), useSettings.getState().saveSize);
    track({ name: 'photo_shared', kind: photo.kind });
  } catch (error) {
    reportError(error, 'photo.share');
    showError();
  }
}
