import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateTagDto {
  name: string;
  color?: string;
}

class UpdateTagDto {
  name?: string;
  color?: string;
}

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) { }

  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.tagsService.findAll(req.user.userId);
  }

  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateTagDto,
  ) {
    return this.tagsService.create(req.user.userId, dto.name, dto.color);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(id, req.user.userId, dto.name, dto.color);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.tagsService.delete(id, req.user.userId);
  }
}

// Separate controller for meeting-tag associations
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingTagsController {
  constructor(private readonly tagsService: TagsService) { }

  @Get(':meetingId/tags')
  async getMeetingTags(
    @Param('meetingId') meetingId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.tagsService.getMeetingTags(meetingId, req.user.userId);
  }

  @Post(':meetingId/tags/:tagId')
  async addTagToMeeting(
    @Param('meetingId') meetingId: string,
    @Param('tagId') tagId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.tagsService.addTagToMeeting(meetingId, tagId, req.user.userId);
  }

  @Delete(':meetingId/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTagFromMeeting(
    @Param('meetingId') meetingId: string,
    @Param('tagId') tagId: string,
    @Request() req: { user: { userId: string } },
  ) {
    await this.tagsService.removeTagFromMeeting(
      meetingId,
      tagId,
      req.user.userId,
    );
  }
}
