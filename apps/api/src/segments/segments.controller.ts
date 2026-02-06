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
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SegmentsService } from './segments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdateSegmentDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  editReason?: string;
}

class ReassignSpeakerDto {
  @IsString()
  @IsNotEmpty()
  speakerId: string;
}

@Controller('segments')
@UseGuards(JwtAuthGuard)
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get(':id')
  async getSegment(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.segmentsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  async updateSegment(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.segmentsService.update(
      id,
      req.user.userId,
      dto.text,
      dto.editReason,
    );
  }

  @Get(':id/history')
  async getEditHistory(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.segmentsService.getEditHistory(id, req.user.userId);
  }

  @Post(':id/revert/:editId')
  async revertToVersion(
    @Param('id') id: string,
    @Param('editId') editId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.segmentsService.revertToVersion(id, editId, req.user.userId);
  }

  @Patch(':id/speaker')
  async reassignSpeaker(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: ReassignSpeakerDto,
  ) {
    return this.segmentsService.reassignSpeaker(
      id,
      dto.speakerId,
      req.user.userId,
    );
  }

  @Post(':id/reset')
  async resetToOriginal(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.segmentsService.resetToOriginal(id, req.user.userId);
  }
}
