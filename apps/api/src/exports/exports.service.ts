import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async generatePdf(
    meetingId: string,
    options: { includeMinutes: boolean; includeTranscript: boolean } = {
      includeMinutes: true,
      includeTranscript: true,
    },
  ): Promise<Buffer> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        minutes: true,
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const result = Buffer.concat(buffers);
        resolve(result);
      });
      doc.on('error', reject);

      // Register a Unicode-compatible font (standard on macOS)
      const unicodeFontPath = '/System/Library/Fonts/Supplemental/KefaIII.ttf';
      doc.registerFont('Ethiopic', unicodeFontPath);

      // Header - Title
      doc.font('Ethiopic').fontSize(24).text(meeting.title, { align: 'left' });
      doc.moveDown(0.5);

      // Metadata
      doc.font('Ethiopic').fontSize(10).fillColor('#666666');
      doc.text(`Date: ${meeting.createdAt.toLocaleDateString()}`);
      if (meeting.transcript && meeting.transcript.length > 0) {
        const lastSegment = meeting.transcript[meeting.transcript.length - 1];
        doc.text(`Duration: ${this.formatTime(lastSegment.endTime)}`);
      }
      doc.text(`Meeting ID: ${meeting.id}`);
      doc.moveDown(1.5);
      doc.fillColor('#000000'); // Reset color

      // Minutes Section
      if (options.includeMinutes && meeting.minutes) {
        doc.font('Ethiopic').fontSize(16).text('Meeting Minutes');
        doc.moveDown(0.5);
        doc.font('Ethiopic').fontSize(11).text(meeting.minutes.content, {
          align: 'justify',
          lineGap: 4,
        });
        doc.moveDown(1.5);
      }

      if (
        options.includeTranscript &&
        meeting.transcript &&
        meeting.transcript.length > 0
      ) {
        // If we also included minutes, start on a new page
        if (options.includeMinutes && meeting.minutes) {
          doc.addPage();
        }
        doc.font('Ethiopic').fontSize(16).text('Full Transcript');
        doc.moveDown(1);

        for (const segment of meeting.transcript) {
          const speaker = segment.speaker?.name || 'Unknown Speaker';
          const time = this.formatTime(segment.startTime);

          // Draw a small timestamp/speaker line
          doc.font('Ethiopic').fontSize(10).fillColor('#4F46E5'); // Violet-600
          doc.text(`[${time}] ${speaker}`);

          doc.font('Ethiopic').fontSize(11).fillColor('#000000');
          doc.text(segment.text, {
            indent: 10,
            lineGap: 3,
          });
          doc.moveDown(0.8);

          // Check for page bottom
          if (doc.y > 700) {
            doc.addPage();
          }
        }
      }

      doc.end();
    });
  }

  async generateText(
    meetingId: string,
    options: {
      includeMinutes: boolean;
      includeTranscript: boolean;
    } = {
      includeMinutes: true,
      includeTranscript: true,
    },
  ): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        minutes: true,
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    let text = `==================================================\n`;
    text += `${meeting.title.toUpperCase()}\n`;
    text += `Date: ${meeting.createdAt.toLocaleDateString()}\n`;
    text += `==================================================\n\n`;

    if (options.includeMinutes && meeting.minutes) {
      text += `SUMMARY / MINUTES\n`;
      text += `-----------------\n`;
      text += `${meeting.minutes.content}\n\n`;
    }

    if (
      options.includeTranscript &&
      meeting.transcript &&
      meeting.transcript.length > 0
    ) {
      text += `FULL TRANSCRIPT\n`;
      text += `---------------\n`;
      for (const segment of meeting.transcript) {
        const speaker = segment.speaker?.name || 'Unknown Speaker';
        const time = this.formatTime(segment.startTime);
        text += `[${time}] ${speaker}: ${segment.text}\n\n`;
      }
    }

    return text;
  }

  async generateMarkdown(
    meetingId: string,
    options: {
      includeMinutes: boolean;
      includeTranscript: boolean;
    } = {
      includeMinutes: true,
      includeTranscript: true,
    },
  ): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        minutes: true,
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    let markdown = `# ${meeting.title}\n\n`;
    markdown += `- **Date:** ${meeting.createdAt.toLocaleDateString()}\n`;

    if (meeting.transcript && meeting.transcript.length > 0) {
      const lastSegment = meeting.transcript[meeting.transcript.length - 1];
      markdown += `- **Duration:** ${this.formatTime(lastSegment.endTime)}\n`;
    }
    markdown += `\n---\n\n`;

    if (options.includeMinutes && meeting.minutes) {
      markdown += `## Summary & Minutes\n\n${meeting.minutes.content}\n\n`;
      if (options.includeTranscript) {
        markdown += `---\n\n`;
      }
    }

    if (
      options.includeTranscript &&
      meeting.transcript &&
      meeting.transcript.length > 0
    ) {
      markdown += `## Full Transcript\n\n`;
      for (const segment of meeting.transcript) {
        const speaker = segment.speaker?.name || 'Unknown Speaker';
        const time = this.formatTime(segment.startTime);
        markdown += `**[${time}] ${speaker}:** ${segment.text}\n\n`;
      }
    }

    return markdown;
  }

  async generateTranscriptOnly(meetingId: string): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting || !meeting.transcript || meeting.transcript.length === 0) {
      throw new NotFoundException('Meeting or transcript not found');
    }

    let text = `TRANSCRIPT: ${meeting.title}\n`;
    text += `Date: ${meeting.createdAt.toLocaleDateString()}\n\n`;

    for (const segment of meeting.transcript) {
      const speaker = segment.speaker?.name || 'Speaker';
      const time = this.formatTime(segment.startTime);
      text += `[${time}] ${speaker}: ${segment.text}\n`;
    }

    return text;
  }

  async generateDocx(
    meetingId: string,
    options: {
      includeMinutes: boolean;
      includeTranscript: boolean;
    } = {
      includeMinutes: true,
      includeTranscript: true,
    },
  ): Promise<Buffer> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        minutes: true,
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: meeting.title,
            bold: true,
            size: 48,
            font: 'Kefa',
          }),
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
      }),
    );

    // Metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${meeting.createdAt.toLocaleDateString()}`,
            italics: true,
            color: '666666',
          }),
        ],
        spacing: { after: 200 },
      }),
    );

    // Minutes section
    if (options.includeMinutes && meeting.minutes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Summary & Minutes',
              bold: true,
              size: 28,
              font: 'Kefa',
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );

      const minutesLines = meeting.minutes.content.split('\n');
      for (const line of minutesLines) {
        if (line.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Kefa' })],
              spacing: { after: 120 },
            }),
          );
        }
      }
    }

    // Transcript section
    if (
      options.includeTranscript &&
      meeting.transcript &&
      meeting.transcript.length > 0
    ) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Full Transcript',
              bold: true,
              size: 28,
              font: 'Kefa',
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: options.includeMinutes && !!meeting.minutes,
        }),
      );

      for (const segment of meeting.transcript) {
        const speaker = segment.speaker?.name || 'Speaker';
        const time = this.formatTime(segment.startTime);
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${time}] `,
                bold: true,
                color: '4F46E5',
                font: 'Kefa',
              }),
              new TextRun({ text: `${speaker}: `, bold: true, font: 'Kefa' }),
              new TextRun({ text: segment.text, font: 'Kefa' }),
            ],
            spacing: { after: 120 },
          }),
        );
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    return Packer.toBuffer(doc);
  }

  async generateSrt(meetingId: string): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting || !meeting.transcript || meeting.transcript.length === 0) {
      throw new NotFoundException('Meeting or transcript not found');
    }

    let srt = '';
    let index = 1;

    for (const segment of meeting.transcript) {
      const speaker = segment.speaker?.name || 'Unknown';
      const startTime = this.formatSrtTime(segment.startTime);
      const endTime = this.formatSrtTime(segment.endTime);

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${speaker}: ${segment.text}\n\n`;
      index++;
    }

    return srt.trim();
  }

  async generateVtt(meetingId: string): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: {
          orderBy: { startTime: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting || !meeting.transcript || meeting.transcript.length === 0) {
      throw new NotFoundException('Meeting or transcript not found');
    }

    let vtt = 'WEBVTT\n\n';

    for (const segment of meeting.transcript) {
      const speaker = segment.speaker?.name || 'Unknown';
      const startTime = this.formatVttTime(segment.startTime);
      const endTime = this.formatVttTime(segment.endTime);

      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `<v ${speaker}>${segment.text}\n\n`;
    }

    return vtt.trim();
  }

  private formatSrtTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private formatVttTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
