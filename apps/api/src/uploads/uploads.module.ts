import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaModule } from '../prisma/prisma.module';
import { UsageModule } from '../usage/usage.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    UsageModule,
    QueueModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './apps/api/uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow common audio formats including browser recording formats
        if (!file.mimetype.match(/audio\/(mpeg|mp3|wav|x-m4a|mp4|webm|ogg|aac|flac|x-wav)$/)) {
          return callback(new Error('Only audio files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule { }
