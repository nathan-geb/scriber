import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  UseGuards,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get(':meetingId/pdf')
  async downloadPdf(
    @Param('meetingId') meetingId: string,
    @Query('include') include: string,
    @Res() res: Response,
  ) {
    try {
      const options = {
        includeMinutes: !include || include.includes('minutes'),
        includeTranscript: !include || include.includes('transcript'),
      };
      const pdfBuffer = await this.exportsService.generatePdf(
        meetingId,
        options,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="meeting-${meetingId}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/text')
  async downloadText(
    @Param('meetingId') meetingId: string,
    @Query('include') include: string,
    @Res() res: Response,
  ) {
    try {
      const options = {
        includeMinutes: !include || include.includes('minutes'),
        includeTranscript: !include || include.includes('transcript'),
      };
      const textContent = await this.exportsService.generateText(
        meetingId,
        options,
      );

      res.set({
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="meeting-${meetingId}.txt"`,
      });

      res.send(textContent);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/markdown')
  async downloadMarkdown(
    @Param('meetingId') meetingId: string,
    @Query('include') include: string,
    @Res() res: Response,
  ) {
    try {
      const options = {
        includeMinutes: !include || include.includes('minutes'),
        includeTranscript: !include || include.includes('transcript'),
      };
      const markdown = await this.exportsService.generateMarkdown(
        meetingId,
        options,
      );

      res.set({
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="meeting-${meetingId}.md"`,
      });

      res.send(markdown);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/transcript')
  async downloadTranscript(
    @Param('meetingId') meetingId: string,
    @Res() res: Response,
  ) {
    try {
      const transcript =
        await this.exportsService.generateTranscriptOnly(meetingId);

      res.set({
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="transcript-${meetingId}.txt"`,
      });

      res.send(transcript);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/docx')
  async downloadDocx(
    @Param('meetingId') meetingId: string,
    @Query('include') include: string,
    @Res() res: Response,
  ) {
    try {
      const options = {
        includeMinutes: !include || include.includes('minutes'),
        includeTranscript: !include || include.includes('transcript'),
      };
      const docxBuffer = await this.exportsService.generateDocx(
        meetingId,
        options,
      );

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="meeting-${meetingId}.docx"`,
        'Content-Length': docxBuffer.length,
      });

      res.send(docxBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/srt')
  async downloadSrt(
    @Param('meetingId') meetingId: string,
    @Res() res: Response,
  ) {
    try {
      const srtContent = await this.exportsService.generateSrt(meetingId);

      res.set({
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="transcript-${meetingId}.srt"`,
      });

      res.send(srtContent);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }

  @Get(':meetingId/vtt')
  async downloadVtt(
    @Param('meetingId') meetingId: string,
    @Res() res: Response,
  ) {
    try {
      const vttContent = await this.exportsService.generateVtt(meetingId);

      res.set({
        'Content-Type': 'text/vtt',
        'Content-Disposition': `attachment; filename="transcript-${meetingId}.vtt"`,
      });

      res.send(vttContent);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  }
}
