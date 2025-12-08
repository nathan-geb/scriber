import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
// import { PlanLimitGuard } from '../auth/plan-limit.guard'; // Use later when enabled

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') languageCode: string, // 'language' field from form-data
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadsService.handleFileUpload(file, req.user, languageCode);
  }
}
