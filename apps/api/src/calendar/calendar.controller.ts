import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

interface GoogleCallbackBody {
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  };
}

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('connections')
  async getConnections(@Request() req: { user: { userId: string } }) {
    return this.calendarService.listConnections(req.user.userId);
  }

  @Post('sync')
  async triggerSync(@Request() req: { user: { userId: string } }) {
    return this.calendarService.syncEvents(req.user.userId);
  }

  @Delete(':provider')
  async disconnect(
    @Request() req: { user: { userId: string } },
    @Param('provider') provider: string,
  ) {
    return this.calendarService.disconnect(
      req.user.userId,
      provider.toUpperCase(),
    );
  }

  @Post('google/callback')
  async googleCallback(
    @Request() req: { user: { userId: string } },
    @Body() body: GoogleCallbackBody,
  ) {
    // This would be called by the frontend after completing the OAuth flow
    return this.calendarService.connectGoogleCalendar(
      req.user.userId,
      body.tokens,
    );
  }
}
