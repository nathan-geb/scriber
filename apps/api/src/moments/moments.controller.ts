import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { MomentsService } from './moments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MomentType } from '@prisma/client';

class CreateMomentDto {
    @IsNumber()
    timestamp: number;

    @IsString()
    @IsNotEmpty()
    label: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(MomentType)
    @IsOptional()
    type?: MomentType;
}

class UpdateMomentDto {
    @IsString()
    @IsOptional()
    label?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(MomentType)
    @IsOptional()
    type?: MomentType;

    @IsNumber()
    @IsOptional()
    timestamp?: number;
}

@Controller('meetings/:meetingId/moments')
@UseGuards(JwtAuthGuard)
export class MomentsController {
    constructor(private readonly momentsService: MomentsService) { }

    @Get()
    async findByMeeting(
        @Param('meetingId') meetingId: string,
        @Request() req: { user: { userId: string } },
    ) {
        return this.momentsService.findByMeeting(meetingId, req.user.userId);
    }

    @Post()
    async create(
        @Param('meetingId') meetingId: string,
        @Request() req: { user: { userId: string } },
        @Body() dto: CreateMomentDto,
    ) {
        return this.momentsService.create(meetingId, req.user.userId, dto);
    }

    @Post('auto-detect')
    async autoDetect(
        @Param('meetingId') meetingId: string,
        @Request() req: { user: { userId: string } },
    ) {
        return this.momentsService.autoDetect(meetingId, req.user.userId);
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Request() req: { user: { userId: string } },
        @Body() dto: UpdateMomentDto,
    ) {
        return this.momentsService.update(id, req.user.userId, dto);
    }

    @Delete(':id')
    async delete(
        @Param('id') id: string,
        @Request() req: { user: { userId: string } },
    ) {
        return this.momentsService.delete(id, req.user.userId);
    }
}
