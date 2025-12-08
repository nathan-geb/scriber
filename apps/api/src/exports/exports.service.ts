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
  constructor(private prisma: PrismaService) { }

  async generatePdf(meetingId: string): Promise<Buffer> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { minutes: true },
    });

    if (!meeting || !meeting.minutes) {
      throw new NotFoundException('Meeting or minutes not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const result = Buffer.concat(buffers);
        resolve(result);
      });
      doc.on('error', reject);

      // Title
      doc.fontSize(25).text(meeting.title, { align: 'center' });
      doc.fontSize(12).text(`Date: ${meeting.createdAt.toLocaleDateString()}`, {
        align: 'center',
      });
      doc.moveDown();

      // Content
      doc.fontSize(14).text('Minutes:', { underline: true });
      doc.moveDown();
      if (meeting.minutes) {
        doc.fontSize(12).text(meeting.minutes.content);
      }

      doc.end();
    });
  }

  async generateText(meetingId: string): Promise<string> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { minutes: true },
    });

    if (!meeting || !meeting.minutes) {
      throw new NotFoundException('Meeting or minutes not found');
    }

    return `Title: ${meeting.title}\nDate: ${meeting.createdAt.toLocaleDateString()}\n\n${meeting.minutes.content}`;
  }

  async generateMarkdown(meetingId: string): Promise<string> {
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
    markdown += `**Date:** ${meeting.createdAt.toLocaleDateString()}\n\n`;

    if (meeting.minutes) {
      markdown += `## Minutes\n\n${meeting.minutes.content}\n\n`;
    }

    if (meeting.transcript && meeting.transcript.length > 0) {
      markdown += `## Transcript\n\n`;
      for (const segment of meeting.transcript) {
        const speaker = segment.speaker?.name || 'Unknown';
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

    let text = `Transcript: ${meeting.title}\nDate: ${meeting.createdAt.toLocaleDateString()}\n\n`;

    for (const segment of meeting.transcript) {
      const speaker = segment.speaker?.name || 'Unknown';
      const time = this.formatTime(segment.startTime);
      text += `[${time}] ${speaker}: ${segment.text}\n`;
    }

    return text;
  }

  async generateDocx(meetingId: string): Promise<Buffer> {
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
        text: meeting.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
    );

    // Date
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${meeting.createdAt.toLocaleDateString()}`,
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );

    children.push(new Paragraph({ text: '' })); // Spacer

    // Minutes section
    if (meeting.minutes) {
      children.push(
        new Paragraph({
          text: 'Minutes',
          heading: HeadingLevel.HEADING_1,
        }),
      );

      // Split minutes content by newlines
      const minutesLines = meeting.minutes.content.split('\n');
      for (const line of minutesLines) {
        children.push(new Paragraph({ text: line }));
      }

      children.push(new Paragraph({ text: '' })); // Spacer
    }

    // Transcript section
    if (meeting.transcript && meeting.transcript.length > 0) {
      children.push(
        new Paragraph({
          text: 'Transcript',
          heading: HeadingLevel.HEADING_1,
        }),
      );

      for (const segment of meeting.transcript) {
        const speaker = segment.speaker?.name || 'Unknown';
        const time = this.formatTime(segment.startTime);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${time}] `, bold: true }),
              new TextRun({ text: `${speaker}: `, bold: true }),
              new TextRun({ text: segment.text }),
            ],
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
