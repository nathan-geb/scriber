export interface StorageProvider {
  name: string;
  upload(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string>;
  download(bucket: string, path: string): Promise<Buffer>;
  delete(bucket: string, path: string): Promise<void>;
  getPublicUrl(bucket: string, path: string): string;
  getSignedUrl(
    bucket: string,
    path: string,
    expiresIn?: number,
  ): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
