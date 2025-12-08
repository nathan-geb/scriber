import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateShareLinkDto {
    @IsString()
    meetingId: string;

    @IsOptional()
    @IsIn(['FULL', 'MINUTES', 'TRANSCRIPT'])
    shareType?: 'FULL' | 'MINUTES' | 'TRANSCRIPT';

    @IsOptional()
    @IsNumber()
    expiresInHours?: number;
}

@Controller('shares')
export class SharesController {
    constructor(private readonly sharesService: SharesService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createShareLink(
        @Request() req: { user: { userId: string } },
        @Body() dto: CreateShareLinkDto,
    ) {
        const shareLink = await this.sharesService.createShareLink(
            req.user.userId,
            dto.meetingId,
            dto.shareType as any,
            dto.expiresInHours,
        );

        // Return the full share URL
        const baseUrl = process.env.WEB_URL || 'http://localhost:3001';
        return {
            ...shareLink,
            shareUrl: `${baseUrl}/share/${shareLink.token}`,
        };
    }

    @Get('meeting/:meetingId')
    @UseGuards(JwtAuthGuard)
    async getShareLinks(
        @Request() req: { user: { userId: string } },
        @Param('meetingId') meetingId: string,
    ) {
        return this.sharesService.getShareLinks(req.user.userId, meetingId);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async revokeShareLink(
        @Request() req: { user: { userId: string } },
        @Param('id') id: string,
    ) {
        await this.sharesService.revokeShareLink(req.user.userId, id);
        return { success: true };
    }

    // Public endpoint - no auth required
    @Get('content/:token')
    async getSharedContent(@Param('token') token: string) {
        return this.sharesService.getSharedContent(token);
    }
}
