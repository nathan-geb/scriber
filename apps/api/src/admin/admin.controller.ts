import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

// ============================================
// DTOs
// ============================================

class UpdatePlanDto {
  @IsString()
  planId: string;
}

class ToggleStatusDto {
  @IsBoolean()
  active: boolean;
}

class CreatePlanDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  maxMinutesPerUpload: number;

  @IsNumber()
  @Min(1)
  maxUploadsPerWeek: number;

  @IsNumber()
  @Min(1)
  monthlyMinutesLimit: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

class UpdatePlanSettingsDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxMinutesPerUpload?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUploadsPerWeek?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  monthlyMinutesLimit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

// ============================================
// CONTROLLER
// ============================================

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  // ============================================
  // DASHBOARD
  // ============================================

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search || undefined,
    );
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Get('users/:id/usage')
  async getUserUsageStats(@Param('id') id: string) {
    return this.adminService.getUserUsageStats(id);
  }

  @Patch('users/:id/plan')
  async updateUserPlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updateUserPlan(id, dto.planId);
  }

  @Patch('users/:id/status')
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() dto: ToggleStatusDto,
  ) {
    return this.adminService.toggleUserStatus(id, dto.active);
  }

  // ============================================
  // PLAN MANAGEMENT
  // ============================================

  @Get('plans')
  async getAllPlans() {
    return this.adminService.getAllPlans();
  }

  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanSettingsDto,
  ) {
    return this.adminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }

  // ============================================
  // PAYMENTS & REVENUE
  // ============================================

  @Get('payments')
  async getPaymentHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPaymentHistory(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('revenue')
  async getRevenueStats() {
    return this.adminService.getRevenueStats();
  }

  // ============================================
  // ANALYTICS
  // ============================================

  @Get('analytics/meetings')
  async getMeetingAnalytics(
    @Query('period') period?: 'day' | 'week' | 'month',
  ) {
    return this.adminService.getMeetingAnalytics(period || 'week');
  }
}
