import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CorrectionsService } from './corrections.service';

class CreateCorrectionDto {
  segmentId: string;
  originalText: string;
  correctedText: string;
}

@Controller('corrections')
@UseGuards(JwtAuthGuard)
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateCorrectionDto,
  ) {
    return this.correctionsService.create(req.user.userId, dto);
  }

  @Get('segment/:segmentId')
  async findBySegment(@Param('segmentId') segmentId: string) {
    return this.correctionsService.findBySegment(segmentId);
  }

  @Get('meeting/:meetingId')
  async findByMeeting(@Param('meetingId') meetingId: string) {
    return this.correctionsService.findByMeeting(meetingId);
  }

  @Delete(':id')
  async delete(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.correctionsService.delete(req.user.userId, id);
  }
}
