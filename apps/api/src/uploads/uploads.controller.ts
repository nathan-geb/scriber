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
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberRolesGuard } from '../auth/guards/member-roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  InitiateChunkedUploadDto,
  CompleteChunkedUploadDto,
} from './dto/chunked-upload.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
    orgId: string;
  };
}

@Controller('uploads')
@UseGuards(JwtAuthGuard, MemberRolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Standard single-file upload
   */
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') languageCode: string,
    @Body('duration') durationStr: string,
    @Body('organizationId') organizationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    // Parse optional client-provided duration (for WebM fallback)
    const clientDuration = durationStr ? parseInt(durationStr, 10) : undefined;
    return await this.uploadsService.handleFileUpload(
      file,
      req.user,
      organizationId,
      languageCode,
      clientDuration,
    );
  }

  /**
   * Initiate a chunked upload session
   */
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post('chunked/initiate')
  async initiateChunkedUpload(
    @Body() dto: InitiateChunkedUploadDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.uploadsService.initiateChunkedUpload(
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
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post('chunked/:uploadId/chunk/:chunkIndex')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @Param('uploadId') uploadId: string,
    @Param('chunkIndex', ParseIntPipe) chunkIndex: number,
    @UploadedFile() chunk: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!chunk) {
      throw new BadRequestException('Chunk data is required');
    }
    return await this.uploadsService.storeChunk(
      uploadId,
      chunkIndex,
      chunk.buffer,
      req.user.userId,
    );
  }

  /**
   * Complete the chunked upload and start processing
   */
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post('chunked/:uploadId/complete')
  async completeChunkedUpload(
    @Param('uploadId') uploadId: string,
    @Body() dto: CompleteChunkedUploadDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.uploadsService.completeChunkedUpload(
      uploadId,
      req.user.userId,
      dto.organizationId,
      dto.language,
    );
  }

  /**
   * Get chunked upload status
   */
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Get('chunked/:uploadId/status')
  async getUploadStatus(
    @Param('uploadId') uploadId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const status = await this.uploadsService.getUploadStatus(
      uploadId,
      req.user.userId,
    );
    if (!status) {
      throw new NotFoundException('Upload session not found');
    }
    return status;
  }
}
