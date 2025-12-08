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
} from '@nestjs/common';
import type { Response } from 'express';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';

interface MeetingQueryParams {
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
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly jobsService: JobsService,
  ) { }

  @Get()
  async findAll(
    @Request() req: { user: { userId: string } },
    @Query() query: MeetingQueryParams,
  ) {
    return this.meetingsService.findAll(req.user.userId, {
      search: query.search,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      cursor: query.cursor,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      tagId: query.tagId,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.meetingsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
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
  @Header('Accept-Ranges', 'bytes')
  async streamAudio(
    @Param('id') id: string,
    @Request() req: { user: { userId: string }; headers: { range?: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const meeting = await this.meetingsService.findOne(id, req.user.userId);

    if (!meeting.fileUrl) {
      throw new NotFoundException('Audio file not found');
    }

    // Resolve file path - fileUrl can be:
    // 1. Absolute path starting with /
    // 2. Relative path from project root (e.g., apps/api/uploads/file.m4a or ./apps/api/uploads/file.m4a)
    // 3. Just filename (legacy), assumed to be in uploads folder
    let filePath: string;
    if (meeting.fileUrl.startsWith('/')) {
      filePath = meeting.fileUrl;
    } else if (meeting.fileUrl.startsWith('./apps/') || meeting.fileUrl.startsWith('apps/')) {
      // Multer relative path - resolve from monorepo root (cwd parent parent for apps/api)
      // cwd() is typically /path/to/Scriber/apps/api
      // We need to go up 2 levels to get to /path/to/Scriber
      const cleanPath = meeting.fileUrl.replace(/^\.\//, ''); // Remove leading ./
      filePath = join(process.cwd(), '..', '..', cleanPath);
    } else {
      // Just filename, use local uploads folder
      filePath = join(process.cwd(), 'uploads', meeting.fileUrl);
    }

    if (!existsSync(filePath)) {
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.meetingsService.delete(id, req.user.userId);
  }

  @Post('batch-delete')
  @HttpCode(HttpStatus.OK)
  async deleteMany(
    @Request() req: { user: { userId: string } },
    @Body('ids') ids: string[],
  ) {
    return this.meetingsService.deleteMany(ids, req.user.userId);
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
    if (meeting.status !== 'FAILED') {
      return { success: false, message: 'Only failed meetings can be retried' };
    }

    const job = await this.jobsService.retryJob(id, req.user.userId);
    return {
      success: true,
      message: 'Job restarted',
      jobId: job.id,
    };
  }
}
