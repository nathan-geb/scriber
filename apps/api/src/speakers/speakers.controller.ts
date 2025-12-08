import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { SpeakersService } from './speakers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class RenameSpeakerDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

class MergeSpeakersDto {
  @IsString()
  @IsNotEmpty()
  targetId: string;
}

@Controller('meetings/:meetingId/speakers')
@UseGuards(JwtAuthGuard)
export class SpeakersController {
  constructor(private readonly speakersService: SpeakersService) { }

  @Get()
  async findByMeeting(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.speakersService.findByMeeting(meetingId, req.user.userId);
  }

  @Patch(':id')
  async rename(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: RenameSpeakerDto,
  ) {
    return this.speakersService.rename(id, req.user.userId, dto.name);
  }

  @Post(':id/merge')
  async merge(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: MergeSpeakersDto,
  ) {
    return this.speakersService.merge(id, dto.targetId, req.user.userId);
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.speakersService.confirm(id, req.user.userId);
  }
}
