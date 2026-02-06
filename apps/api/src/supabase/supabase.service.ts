import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      this.logger.error(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables',
      );
      // We don't throw here to allow the app to boot, but storage calls will fail
    } else {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      });
      this.logger.log('Supabase client initialized');
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Failed to upload file to Supabase: ${error.message}`);
      throw error;
    }

    return data;
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn = 3600,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      this.logger.error(`Failed to create signed URL: ${error.message}`);
      throw error;
    }

    return data.signedUrl;
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .download(path);

    if (error) {
      this.logger.error(
        `Failed to download file from Supabase: ${error.message}`,
      );
      throw error;
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      this.logger.error(
        `Failed to delete file from Supabase: ${error.message}`,
      );
      throw error;
    }
  }
}
