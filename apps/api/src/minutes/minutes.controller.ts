import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { MinutesService } from './minutes.service';
import type { MinutesTemplate } from './minutes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from '../queue/jobs.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberRolesGuard } from '../auth/guards/member-roles.guard';

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

class UpdateMinutesStatusDto {
  @IsIn(['DRAFT', 'UNDER_REVIEW', 'APPROVED'])
  status: string;
}

@Controller('minutes')
@UseGuards(JwtAuthGuard, MemberRolesGuard)
export class MinutesController {
  constructor(
    private readonly minutesService: MinutesService,
    private readonly jobsService: JobsService,
  ) { }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post(':meetingId/translate')
  async translateMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string; orgId?: string } },
    @Body() dto: TranslateMinutesDto,
  ) {
    return await this.minutesService.translateMinutes(
      meetingId,
      req.user.userId,
      dto.language,
    );
  }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post('generate')
  async generateMinutes(@Body() dto: GenerateMinutesDto) {
    return await this.minutesService.generateMinutes(
      dto.meetingId,
      dto.template,
    );
  }

  @Roles('VIEWER', 'MEMBER', 'ADMIN', 'OWNER')
  @Get(':meetingId')
  async getMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string; orgId?: string } },
  ) {
    const minutes = await this.minutesService.getMinutes(
      meetingId,
      req.user.userId,
      req.user.orgId,
    );
    if (!minutes) throw new NotFoundException('Minutes not found');
    return minutes;
  }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post(':meetingId')
  async updateMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string; orgId?: string } },
    @Body('content') content: string,
  ) {
    return await this.minutesService.updateMinutes(
      meetingId,
      req.user.userId,
      content,
      req.user.orgId,
    );
  }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post(':meetingId/regenerate')
  async regenerateMinutes(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string; orgId?: string } },
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

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Patch(':meetingId/status')
  async updateStatus(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string; orgId?: string } },
    @Body() dto: UpdateMinutesStatusDto,
  ) {
    return await this.minutesService.updateStatus(
      meetingId,
      req.user.userId,
      dto.status,
      req.user.orgId,
    );
  }

  @Roles('VIEWER', 'MEMBER', 'ADMIN', 'OWNER')
  @Get(':meetingId/versions')
  async getVersionHistory(@Param('meetingId') meetingId: string) {
    return await this.minutesService.getVersionHistory(meetingId);
  }

  @Roles('MEMBER', 'ADMIN', 'OWNER')
  @Post(':meetingId/revert/:version')
  async revertToVersion(
    @Param('meetingId') meetingId: string,
    @Param('version') version: string,
    @Request() req: { user: { userId: string } },
  ) {
    return await this.minutesService.revertToVersion(
      meetingId,
      parseInt(version, 10),
      req.user.userId,
    );
  }
}
