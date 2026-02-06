import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
  Header,
  StreamableFile,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberRolesGuard } from '../auth/guards/member-roles.guard';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

interface MeetingQueryParams {
  organizationId?: string;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  cursor?: string;
  limit?: string;
  tagId?: string;
}

import { JobsService } from '../queue/jobs.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard, MemberRolesGuard)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly jobsService: JobsService,
  ) {}

  @Get()
  @Roles('VIEWER')
  async findAll(
    @Request() req: { user: { userId: string } },
    @Query() query: MeetingQueryParams,
  ) {
    return this.meetingsService.findAll(req.user.userId, {
      organizationId: query.organizationId,
      search: query.search,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      cursor: query.cursor,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      tagId: query.tagId,
    });
  }

  @Get('search')
  @Roles('VIEWER')
  async search(
    @Request() req: { user: { userId: string } },
    @Query('q') query: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.meetingsService.findAll(req.user.userId, {
      search: query,
      organizationId,
      limit: 50,
    });
  }

  @Get(':id')
  @Roles('VIEWER')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.meetingsService.findOne(id, req.user.userId, organizationId);
  }

  @Patch(':id')
  @Roles('MEMBER')
  async update(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() body: { title?: string },
  ) {
    if (body.title) {
      return this.meetingsService.updateTitle(id, req.user.userId, body.title);
    }
    return { id };
  }

  @Get(':id/audio')
  @Roles('VIEWER')
  @Header('Accept-Ranges', 'bytes')
  async streamAudio(
    @Param('id') id: string,
    @Request() req: { user: { userId: string }; headers: { range?: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    const meeting = await this.meetingsService.findOne(id, req.user.userId);

    if (!meeting.fileUrl) {
      throw new NotFoundException('Audio file not found');
    }

    // Handle Supabase paths - Redirect to signed URL
    if (meeting.fileUrl.startsWith('recordings/')) {
      const signedUrl = await this.meetingsService.getSignedUrl(
        'recordings',
        meeting.fileUrl,
      );
      return res.redirect(signedUrl);
    }

    // Resolve file path - fileUrl can be:
    // 1. Absolute path starting with /
    // 2. Relative path from project root (e.g., apps/api/uploads/file.m4a or ./apps/api/uploads/file.m4a)
    // 3. Relative path from API folder (e.g., uploads/file.webm or ./uploads/file.webm)
    // 4. Just filename (legacy), check multiple possible locations
    let filePath: string = '';

    if (meeting.fileUrl.startsWith('/')) {
      // Absolute path
      filePath = meeting.fileUrl;
    } else if (
      meeting.fileUrl.startsWith('./apps/') ||
      meeting.fileUrl.startsWith('apps/')
    ) {
      // Full relative path from monorepo root
      const cleanPath = meeting.fileUrl.replace(/^\.\//, '');
      filePath = join(process.cwd(), '..', '..', cleanPath);
    } else if (
      meeting.fileUrl.startsWith('./uploads/') ||
      meeting.fileUrl.startsWith('uploads/')
    ) {
      // Relative path from API folder (new format from fixed multer config)
      const cleanPath = meeting.fileUrl.replace(/^\.\//, '');
      filePath = join(process.cwd(), cleanPath);
    } else {
      // Just filename - check multiple possible locations
      const possiblePaths = [
        join(process.cwd(), 'uploads', meeting.fileUrl), // ./uploads/
        join(process.cwd(), 'apps', 'api', 'uploads', meeting.fileUrl), // ./apps/api/uploads/ (legacy nested)
      ];

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          filePath = path;
          break;
        }
      }
    }

    if (!filePath || !existsSync(filePath)) {
      throw new NotFoundException('Audio file not found on disk');
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type from extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
    };
    const contentType = mimeTypes[ext || ''] || 'audio/mpeg';

    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      const stream = createReadStream(filePath, { start, end });
      return new StreamableFile(stream);
    }

    // Full file response
    res.set({
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });

    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.meetingsService.delete(id, req.user.userId);
  }

  @Post('batch-delete')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteMany(
    @Request() req: { user: { userId: string } },
    @Body('ids') ids: string[],
  ) {
    return this.meetingsService.deleteMany(ids, req.user.userId);
  }

  @Post(':id/cancel')
  async cancelJob(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    // Verify meeting exists and belongs to user
    const meeting = await this.meetingsService.findOne(id, req.user.userId);

    // Only allow cancelling processing meetings
    const processingStatuses = [
      'UPLOADING',
      'UPLOADED',
      'PROCESSING_TRANSCRIPT',
      'PROCESSING_MINUTES',
    ];
    if (!processingStatuses.includes(meeting.status)) {
      return {
        success: false,
        message: 'Only processing meetings can be cancelled',
      };
    }

    // Update status to CANCELLED
    await this.meetingsService.updateStatus(id, req.user.userId, 'CANCELLED');

    return { success: true, message: 'Meeting cancelled' };
  }

  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    const meeting = await this.meetingsService.findOne(id, req.user.userId);
    const job = await this.jobsService.getJobByMeetingId(id);

    return {
      status: meeting.status,
      job: job
        ? {
            id: job.id,
            state: job.state,
            progress: job.progress,
            name: job.name,
          }
        : null,
    };
  }

  @Post(':id/retry')
  async retryJob(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    // Verify meeting exists and belongs to user
    const meeting = await this.meetingsService.findOne(id, req.user.userId);

    // Allow retrying FAILED or CANCELLED meetings
    if (meeting.status !== 'FAILED' && meeting.status !== 'CANCELLED') {
      return {
        success: false,
        message: 'Only failed or cancelled meetings can be retried',
      };
    }

    if (!meeting.fileUrl) {
      return {
        success: false,
        message: 'FILE_MISSING',
        details: 'No file URL associated with this meeting.',
      };
    }

    // Check if file exists before retrying
    // Similar to streamAudio path resolution logic
    let filePath: string = '';
    if (meeting.fileUrl.startsWith('/')) {
      filePath = meeting.fileUrl;
    } else if (
      meeting.fileUrl.startsWith('./apps/') ||
      meeting.fileUrl.startsWith('apps/')
    ) {
      const cleanPath = meeting.fileUrl.replace(/^\.\//, '');
      filePath = join(process.cwd(), '..', '..', cleanPath);
    } else if (
      meeting.fileUrl.startsWith('./uploads/') ||
      meeting.fileUrl.startsWith('uploads/')
    ) {
      const cleanPath = meeting.fileUrl.replace(/^\.\//, '');
      filePath = join(process.cwd(), cleanPath);
    } else {
      const possiblePaths = [
        join(process.cwd(), 'uploads', meeting.fileUrl),
        join(process.cwd(), 'apps', 'api', 'uploads', meeting.fileUrl),
      ];
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          filePath = path;
          break;
        }
      }
    }

    if (!filePath || !existsSync(filePath)) {
      return {
        success: false,
        message: 'FILE_MISSING', // Specific code for UI to handle
        details: 'The original audio file was deleted or lost.',
      };
    }

    const result = await this.jobsService.retryJob(id, req.user.userId);

    // Check if result is already a status object (smart retry can return early)
    if ('success' in result) {
      return result;
    }

    // Otherwise it's a Job
    return {
      success: true,
      message: 'Job restarted',
      jobId: result.id,
    };
  }

  @Get(':id/signed-url')
  async getSignedUrl(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    const meeting = await this.meetingsService.findOne(id, req.user.userId);
    if (!meeting.fileUrl) {
      throw new NotFoundException('No file associated with this meeting');
    }

    // If it's a Supabase path
    if (meeting.fileUrl.startsWith('recordings/')) {
      const url = await this.meetingsService.getSignedUrl(
        'recordings',
        meeting.fileUrl,
      );
      return { url };
    }

    // For legacy local files
    return { url: `/api/meetings/${id}/audio` };
  }
}
