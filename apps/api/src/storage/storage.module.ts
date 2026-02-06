import { Module, Global } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [
    LocalStorageProvider,
    SupabaseStorageProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (
        local: LocalStorageProvider,
        supabase: SupabaseStorageProvider,
      ) => {
        // Real-world logic: choose based on env
        return process.env.NODE_ENV === 'production' ? supabase : local;
      },
      inject: [LocalStorageProvider, SupabaseStorageProvider],
    },
  ],
  exports: ['STORAGE_PROVIDER'],
})
export class StorageModule {}
