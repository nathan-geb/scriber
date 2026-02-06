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
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class TemplateSectionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  enabled: boolean;

  order: number;

  @IsString()
  @IsOptional()
  prompt?: string;
}

class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  format: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections: TemplateSectionDto[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  @IsOptional()
  sections?: TemplateSectionDto[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    const userTemplates = await this.templatesService.findAll(req.user.userId);
    const systemTemplates = this.templatesService.getSystemTemplates();

    return {
      user: userTemplates,
      system: systemTemplates,
    };
  }

  @Get('system')
  getSystemTemplates() {
    return this.templatesService.getSystemTemplates();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.templatesService.findOne(id, req.user.userId);
  }

  @Post()
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.templatesService.delete(id, req.user.userId);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.templatesService.duplicate(id, req.user.userId);
  }
}
