import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TranscriptionsService } from './transcriptions.service';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from '../queue/jobs.service';

@Controller('transcriptions')
export class TranscriptionsController {
  constructor(
    private readonly transcriptionsService: TranscriptionsService,
    private readonly jobsService: JobsService,
  ) { }

  @UseGuards(AuthGuard('jwt'))
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

  // Add GET endpoint later for polling status
}
