import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN not provided. Telegram bot functionality will be disabled.',
      );
      return;
    }
    this.logger.log('Telegram Bot initialized');
  }

  async handleUpdate(update: any) {
    if (!update.message) return;

    const { chat, text, voice, audio } = update.message;
    const telegramId = update.message.from.id.toString();

    // 1. Check if user is linked
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      if (text?.startsWith('/link ')) {
        const code = text.split(' ')[1];
        return this.linkAccount(chat.id.toString(), telegramId, code);
      }
      return this.sendMessage(
        chat.id.toString(),
        'Welcome! Your Telegram account is not linked to Scriber yet.\n\nPlease go to your <b>Scriber Dashboard</b>, click on "Link Telegram", and use the code provided: <code>/link &lt;code&gt;</code>',
      );
    }

    // 2. Handle commands if linked
    if (text === '/start') {
      return this.sendMessage(
        chat.id.toString(),
        `Hi ${user.name || 'there'}! You are linked to Scriber (${user.email}).\n\nSend or forward any voice message here, and I will transcribe it for you.`,
      );
    }

    // 3. Handle voice/audio messages
    if (voice || audio) {
      return this.handleVoiceMessage(
        chat.id.toString(),
        user.id,
        voice || audio,
      );
    }

    if (text) {
      return this.sendMessage(
        chat.id.toString(),
        'Send me a voice message to transcribe it!',
      );
    }
  }

  private async linkAccount(chatId: string, telegramId: string, code: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramLinkCode: code },
      });

      if (!user) {
        return this.sendMessage(
          chatId,
          '❌ Invalid or expired linking code. Please check your dashboard for a new one.',
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          telegramId,
          telegramChatId: chatId,
          telegramLinkCode: null, // Clear the code after use
        },
      });

      return this.sendMessage(
        chatId,
        `✅ Successfully linked to <b>${user.email}</b>! You can now send voice messages.`,
      );
    } catch (error) {
      this.logger.error('Failed to link Telegram account:', error);
      return this.sendMessage(
        chatId,
        '❌ An error occurred during linking. Please try again later.',
      );
    }
  }

  private async handleVoiceMessage(chatId: string, userId: string, voice: any) {
    const fileId = voice.file_id;
    await this.sendMessage(
      chatId,
      '🎙️ <i>Received voice message. Processing...</i>',
    );

    try {
      // Logic for downloading from Telegram and uploading to Scriber
      // 1. Get file path from Telegram
      const fileResponse = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`,
      );
      const fileData = await fileResponse.json();

      if (!fileData.ok)
        throw new Error('Failed to get file info from Telegram');

      const filePath = fileData.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

      // 2. We could trigger the upload pipeline here
      // For now, let's acknowledge
      await this.sendMessage(
        chatId,
        `✨ Got it! I'm transcribing your recording now. Check the dashboard in a moment.`,
      );

      this.logger.log(
        `Triggering transcription for user ${userId} from Telegram file ${fileId}`,
      );
      // TODO: Actually call UploadsService.handleTelegramVoice(userId, fileUrl)
    } catch (error) {
      this.logger.error('Failed to handle voice message:', error);
      await this.sendMessage(
        chatId,
        "❌ Sorry, I couldn't process that voice message.",
      );
    }
  }

  async sendMessage(chatId: string, text: string) {
    if (!this.botToken) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });
    } catch (error) {
      this.logger.error(`Failed to send Telegram message to ${chatId}:`, error);
    }
  }
}
