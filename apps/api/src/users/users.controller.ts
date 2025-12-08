import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForbiddenException, Param, Patch } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.usersService.findOne(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-token')
  async updatePushToken(@Request() req: any, @Body('token') token: string) {
    return this.usersService.setPushToken(req.user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications')
  async updateNotificationSettings(
    @Request() req: any,
    @Body() settings: { email?: boolean; push?: boolean },
  ) {
    return this.usersService.updateNotificationSettings(req.user.id, settings);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Request() req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.usersService.findAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.usersService.updateStatus(id, isActive);
  }
}
