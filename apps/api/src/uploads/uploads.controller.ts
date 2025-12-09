import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
  Body,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  InitiateChunkedUploadDto,
  CompleteChunkedUploadDto,
} from './dto/chunked-upload.dto';
// import { PlanLimitGuard } from '../auth/plan-limit.guard'; // Use later when enabled

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  /**
   * Standard single-file upload
   */
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') languageCode: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.uploadsService.handleFileUpload(file, req.user, languageCode);
  }

  /**
   * Initiate a chunked upload session
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/initiate')
  async initiateChunkedUpload(
    @Body() dto: InitiateChunkedUploadDto,
    @Request() req: any,
  ) {
    return this.uploadsService.initiateChunkedUpload(
      req.user.userId,
      dto.filename,
      dto.totalSize,
      dto.totalChunks,
      dto.mimeType,
      dto.language,
    );
  }

  /**
   * Upload a single chunk
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/:uploadId/chunk/:chunkIndex')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @Param('uploadId') uploadId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
    @UploadedFile() chunk: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!chunk) {
      throw new BadRequestException('Chunk data is required');
    }
    return this.uploadsService.storeChunk(
      uploadId,
      chunkIndex,
      chunk.buffer,
      req.user.userId,
    );
  }

  /**
   * Complete the chunked upload and start processing
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('chunked/:uploadId/complete')
  async completeChunkedUpload(
    @Param('uploadId') uploadId: string,
    @Body() dto: CompleteChunkedUploadDto,
    @Request() req: any,
  ) {
    return this.uploadsService.completeChunkedUpload(
      uploadId,
      req.user.userId,
      dto.language,
    );
  }

  /**
   * Get chunked upload status
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('chunked/:uploadId/status')
  async getUploadStatus(
    @Param('uploadId') uploadId: string,
    @Request() req: any,
  ) {
    const status = this.uploadsService.getUploadStatus(
      uploadId,
      req.user.userId,
    );
    if (!status) {
      throw new NotFoundException('Upload session not found');
    }
    return status;
  }
}
