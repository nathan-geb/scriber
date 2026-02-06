import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';

  constructor(private supabase: SupabaseService) {}

  async upload(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .upload(path, buffer, { contentType: mimeType, upsert: true });

    if (error) throw error;
    return data.path;
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .download(path);

    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .remove([path]);

    if (error) throw error;
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase
      .getClient()
      .storage.from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }
}
