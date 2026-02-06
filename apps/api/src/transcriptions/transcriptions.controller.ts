import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { TranscriptionsService } from './transcriptions.service';
import { JobsService } from '../queue/jobs.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberRolesGuard } from '../auth/guards/member-roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('transcriptions')
@UseGuards(JwtAuthGuard, MemberRolesGuard)
export class TranscriptionsController {
  constructor(
    private readonly transcriptionsService: TranscriptionsService,
    private readonly jobsService: JobsService,
  ) { }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post()
  async createTranscription(
    @Body('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
  ) {
    // For now, we'll keep it synchronous to match frontend expectations
    // const job = await this.jobsService.addTranscriptionJob({
    //   meetingId,
    //   userId: req.user.userId,
    // });

    return await this.transcriptionsService.transcribe(meetingId);
  }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post(':meetingId/enhance')
  async enhanceTranscript(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
    @Query('apply') apply?: string,
  ) {
    const applyChanges = apply !== 'false';
    return await this.transcriptionsService.enhanceTranscript(
      meetingId,
      req.user.userId,
      applyChanges,
    );
  }

  @Roles('ADMIN', 'OWNER')
  @Post(':meetingId/redact')
  async redactTranscript(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
    @Query('apply') apply?: string,
  ) {
    const applyChanges = apply !== 'false';
    return await this.transcriptionsService.redactTranscript(
      meetingId,
      req.user.userId,
      applyChanges,
    );
  }
  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Patch(':meetingId/segments/:segmentId')
  async updateSegment(
    @Param('meetingId') meetingId: string,
    @Param('segmentId') segmentId: string,
    @Body('text') text: string,
    @Request() req: { user: { userId: string } },
  ) {
    return await this.transcriptionsService.updateSegment(
      meetingId,
      segmentId,
      text,
      req.user.userId,
    );
  }
}
