import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TemplateSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  prompt?: string;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  format: string;
  sections: TemplateSection[];
  isDefault?: boolean;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  format?: string;
  sections?: TemplateSection[];
  isDefault?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.minutesTemplate.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.minutesTemplate.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async create(userId: string, data: CreateTemplateDto) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.minutesTemplate.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.minutesTemplate.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        format: data.format,
        sections: data.sections as unknown as object,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async update(id: string, userId: string, data: UpdateTemplateDto) {
    const template = await this.findOne(id, userId);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.minutesTemplate.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.minutesTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        format: data.format,
        sections: data.sections as unknown as object,
        isDefault: data.isDefault,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.minutesTemplate.delete({ where: { id } });
    return { success: true };
  }

  async duplicate(id: string, userId: string) {
    const template = await this.findOne(id, userId);

    return this.prisma.minutesTemplate.create({
      data: {
        userId,
        name: `${template.name} (Copy)`,
        description: template.description,
        format: template.format,
        sections: template.sections as object,
        isDefault: false,
      },
    });
  }

  // Get built-in system templates
  getSystemTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    format: string;
    sections: TemplateSection[];
  }> {
    return [
      {
        id: 'standard',
        name: 'Standard Minutes',
        description: 'Balanced format with key sections',
        format: 'markdown',
        sections: [
          { id: 'summary', name: 'Summary', enabled: true, order: 1 },
          { id: 'attendees', name: 'Attendees', enabled: true, order: 2 },
          {
            id: 'discussion',
            name: 'Discussion Points',
            enabled: true,
            order: 3,
          },
          { id: 'decisions', name: 'Decisions Made', enabled: true, order: 4 },
          { id: 'actions', name: 'Action Items', enabled: true, order: 5 },
        ],
      },
      {
        id: 'executive',
        name: 'Executive Summary',
        description: 'Brief overview for leadership',
        format: 'bullets',
        sections: [
          { id: 'summary', name: 'Key Takeaways', enabled: true, order: 1 },
          {
            id: 'decisions',
            name: 'Critical Decisions',
            enabled: true,
            order: 2,
          },
          { id: 'actions', name: 'Next Steps', enabled: true, order: 3 },
        ],
      },
      {
        id: 'comprehensive',
        name: 'Comprehensive',
        description: 'Detailed documentation with all sections',
        format: 'formal',
        sections: [
          { id: 'attendees', name: 'Attendees', enabled: true, order: 1 },
          { id: 'agenda', name: 'Agenda Items', enabled: true, order: 2 },
          { id: 'summary', name: 'Meeting Summary', enabled: true, order: 3 },
          {
            id: 'discussion',
            name: 'Detailed Discussion',
            enabled: true,
            order: 4,
          },
          {
            id: 'decisions',
            name: 'Decisions & Resolutions',
            enabled: true,
            order: 5,
          },
          {
            id: 'actions',
            name: 'Action Items & Owners',
            enabled: true,
            order: 6,
          },
          {
            id: 'followup',
            name: 'Follow-up Required',
            enabled: true,
            order: 7,
          },
        ],
      },
      {
        id: 'action-focused',
        name: 'Action-Focused',
        description: 'Emphasis on tasks and deadlines',
        format: 'bullets',
        sections: [
          {
            id: 'actions',
            name: 'Action Items',
            enabled: true,
            order: 1,
            prompt: 'List all action items with assignees and deadlines',
          },
          { id: 'decisions', name: 'Key Decisions', enabled: true, order: 2 },
          {
            id: 'blockers',
            name: 'Blockers & Issues',
            enabled: true,
            order: 3,
          },
        ],
      },
    ];
  }
}
