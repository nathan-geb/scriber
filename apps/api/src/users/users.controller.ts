import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  ForbiddenException,
  Param,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: { user: { email: string } }) {
    return await this.usersService.findOne(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-token')
  async updatePushToken(
    @Request() req: { user: { userId: string } },
    @Body('token') token: string,
  ) {
    return await this.usersService.setPushToken(req.user.userId, token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications')
  async updateNotificationSettings(
    @Request() req: { user: { userId: string } },
    @Body() settings: { email?: boolean; push?: boolean },
  ) {
    return await this.usersService.updateNotificationSettings(
      req.user.userId,
      settings,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: { user: { role: string } }) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return await this.usersService.findAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return await this.usersService.updateStatus(id, isActive);
  }

  @UseGuards(JwtAuthGuard)
  @Post('telegram-link')
  async generateTelegramLink(@Request() req: { user: { userId: string } }) {
    const code = await this.usersService.generateTelegramLinkCode(
      req.user.userId,
    );
    return { code };
  }
}
