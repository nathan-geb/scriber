import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { MinutesService } from './minutes.service';
import type { MinutesTemplate } from './minutes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from '../queue/jobs.service';

const VALID_TEMPLATES = ['EXECUTIVE', 'DETAILED', 'ACTION_ITEMS'] as const;

class GenerateMinutesDto {
  @IsString()
  meetingId: string;

  @IsOptional()
  @IsIn(VALID_TEMPLATES)
  template?: MinutesTemplate;
}

class RegenerateMinutesDto {
  @IsIn(VALID_TEMPLATES)
  template: MinutesTemplate;
}

class TranslateMinutesDto {
  @IsString()
  language: string;
}

@Controller('minutes')
@UseGuards(JwtAuthGuard)
export class MinutesController {
  constructor(
    private readonly minutesService: MinutesService,
    private readonly jobsService: JobsService,
  ) { }

  // ... (previous endpoints)

  @Post(':meetingId/translate')
  async translateMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: TranslateMinutesDto,
  ) {
    return this.minutesService.translateMinutes(
      meetingId,
      req.user.userId,
      dto.language,
    );
  }

  @Post('generate')
  // ... (rest of file)
  async generateMinutes(
    @Body() dto: GenerateMinutesDto,
    @Request() req: { user: { userId: string } },
  ) {
    // For now, we'll keep it synchronous to match frontend expectations
    // const job = await this.jobsService.addMinutesJob({
    //   meetingId: dto.meetingId,
    //   userId: req.user.userId,
    //   template: dto.template,
    // });

    return await this.minutesService.generateMinutes(dto.meetingId, dto.template);
  }

  @Get(':meetingId')
  async getMinutes(@Param('meetingId') meetingId: string) {
    const minutes = await this.minutesService.getMinutes(meetingId);
    if (!minutes) throw new NotFoundException('Minutes not found');
    return minutes;
  }

  @Post(':meetingId')
  async updateMinutes(
    @Param('meetingId') meetingId: string,
    @Body('content') content: string,
  ) {
    return this.minutesService.updateMinutes(meetingId, content);
  }

  @Post(':meetingId/regenerate')
  async regenerateMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: RegenerateMinutesDto,
  ) {
    const job = await this.jobsService.addMinutesJob({
      meetingId,
      userId: req.user.userId,
      template: dto.template,
    });

    return {
      message: 'Minutes regeneration started',
      jobId: job.id,
      meetingId,
    };
  }

  @Get(':meetingId/versions')
  async getVersionHistory(@Param('meetingId') meetingId: string) {
    return this.minutesService.getVersionHistory(meetingId);
  }

  @Post(':meetingId/revert/:version')
  async revertToVersion(
    @Param('meetingId') meetingId: string,
    @Param('version') version: string,
  ) {
    return this.minutesService.revertToVersion(meetingId, parseInt(version, 10));
  }
}
