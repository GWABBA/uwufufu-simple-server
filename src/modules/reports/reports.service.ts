import { MessageResponseDto } from 'src/core/dtos/message-response.dto';
import { ReportsRepository } from './reports.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { CreateReportBodyDto } from './dtos/create-report-body.dto';
import { GamesRepository } from '../games/games.repository';
import fetch from 'node-fetch';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly gamesRepository: GamesRepository,
  ) {}

  private readonly DISCORD_WEBHOOK_URL =
    'https://discord.com/api/webhooks/1371289888506253353/W8v11wRYdvdOisvI9ONlFBtszjZB9lEBEovOMsLiNJZF0JEMv2sVZsZINa5bgl1s6Va2';

  async createReport(
    createReportBodyDto: CreateReportBodyDto,
    user: UserFromToken,
  ): Promise<MessageResponseDto> {
    const { gameId, reason } = createReportBodyDto;

    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      select: ['id', 'slug', 'title'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const report = this.reportsRepository.create({
      userId: user.userId,
      gameId,
      reason,
    });

    await this.reportsRepository.save(report);

    // 🔔 Discord alert with slug
    try {
      await fetch(this.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **New Game Report Submitted**\n👤 User ID: \`${user.userId}\`\n🎮 Game: [${game.title}](https://uwufufu.com/worldcup/${game.slug})\n🆔 Game ID: \`${game.id}\`\n📝 Reason: \`${reason}\``,
        }),
      });
    } catch (error) {
      console.error('❌ Failed to send Discord webhook:', error);
    }

    return {
      message: 'Report created successfully',
    };
  }
}
