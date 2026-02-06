import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly baseDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(
    bucket: string,
    filePath: string,
    buffer: Buffer,
  ): Promise<string> {
    const fullPath = path.join(this.baseDir, bucket, filePath);
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await fs.writeFile(fullPath, buffer);
    return fullPath;
  }

  async download(bucket: string, filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, bucket, filePath);
    return await fs.readFile(fullPath);
  }

  async delete(bucket: string, filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, bucket, filePath);
    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
    }
  }

  getPublicUrl(bucket: string, filePath: string): string {
    // In a real local setup, this would be a URL to the static files endpoint
    return `/uploads/${bucket}/${filePath}`;
  }

  async getSignedUrl(
    bucket: string,
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    // For local storage, we don't have real signed URLs, but we can return the endpoint path
    return this.getPublicUrl(bucket, filePath);
  }
}
