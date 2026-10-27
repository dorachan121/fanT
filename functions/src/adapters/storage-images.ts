import type { Storage } from 'firebase-admin/storage';

import type { ImageStore } from '../ports';

type Bucket = ReturnType<Storage['bucket']>;

/** How long a result link works; the app downloads it right away. */
const LINK_TTL_MS = 60 * 60 * 1000;

/** Uploads and results in Cloud Storage under `generations/<id>/`, private to the server. */
export class StorageImages implements ImageStore {
  constructor(private readonly bucket: Bucket) {}

  async putInput(id: string, jpeg: Uint8Array): Promise<void> {
    await this.bucket
      .file(`generations/${id}/input.jpg`)
      .save(Buffer.from(jpeg), { contentType: 'image/jpeg', resumable: false });
  }

  async getInput(id: string): Promise<Uint8Array> {
    const [contents] = await this.bucket.file(`generations/${id}/input.jpg`).download();
    return contents;
  }

  async putOutput(id: string, image: Uint8Array): Promise<void> {
    await this.bucket
      .file(`generations/${id}/output.jpg`)
      .save(Buffer.from(image), { contentType: 'image/jpeg', resumable: false });
  }

  async outputUrl(id: string): Promise<string> {
    const [url] = await this.bucket
      .file(`generations/${id}/output.jpg`)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + LINK_TTL_MS });
    return url;
  }

  async deleteImages(id: string): Promise<void> {
    await this.bucket.deleteFiles({ prefix: `generations/${id}/` });
  }
}
