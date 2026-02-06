import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any) {
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }
}
