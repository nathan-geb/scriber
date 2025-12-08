import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) { }

  @Get()
  async getMyActiveJobs(@Request() req: { user: { userId: string } }) {
    return this.jobsService.getUserActiveJobs(req.user.userId);
  }

  @Get(':id')
  async getJobStatus(
    @Param('id') id: string,
    @Query('type') type: 'transcription' | 'minutes' = 'transcription',
  ) {
    const job = await this.jobsService.getJobStatus(id, type);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  @Delete('meeting/:meetingId')
  async cancelJob(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
  ) {
    const result = await this.jobsService.cancelJob(meetingId, req.user.userId);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }
    return result;
  }
}
