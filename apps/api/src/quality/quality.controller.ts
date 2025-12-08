import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    Request,
    NotFoundException,
} from '@nestjs/common';
import { QualityService } from './quality.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('meetings/:meetingId/quality')
@UseGuards(JwtAuthGuard)
export class QualityController {
    constructor(private readonly qualityService: QualityService) { }

    @Get()
    async getQuality(
        @Param('meetingId') meetingId: string,
        @Request() req: { user: { userId: string } },
    ) {
        const report = await this.qualityService.getQualityReport(
            meetingId,
            req.user.userId,
        );

        if (!report) {
            throw new NotFoundException('Meeting not found');
        }

        return report;
    }

    @Post('recalculate')
    async recalculate(
        @Param('meetingId') meetingId: string,
        @Request() req: { user: { userId: string } },
    ) {
        // First verify user owns the meeting
        const report = await this.qualityService.getQualityReport(
            meetingId,
            req.user.userId,
        );

        if (!report) {
            throw new NotFoundException('Meeting not found');
        }

        return this.qualityService.updateMeetingQuality(meetingId);
    }
}
