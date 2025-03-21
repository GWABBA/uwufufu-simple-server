import { Injectable, NotFoundException } from '@nestjs/common';
import { SelectionsRepository } from './selections.repository';
import { GamesRepository } from '../games/games.repository';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { GetSelectionsForEditParams } from './dtos/get-selections-for-edit-params.dtos';
import { SelectionsListResponseDto } from './dtos/selections-list-response.dto';
import { plainToInstance } from 'class-transformer';
import { CreateSelectionWithVideoBodyDto } from './dtos/create-selection-with-video-body.dto';
import { SelectionResponseDto } from './dtos/selection-response.dto';
import { UpdateSelectionBodyDto } from './dtos/update-selection-body.dto';
import { GetSelectionsParams } from './dtos/get-selections-params.dto';
import { RedisService } from 'src/core/redis/redis.service';
import { ILike } from 'typeorm';

@Injectable()
export class SelectionsService {
  constructor(
    private readonly selectionsRepository: SelectionsRepository,
    private readonly gamesRepository: GamesRepository,
    private readonly redisService: RedisService,
  ) {}

  async getSelections(
    params: GetSelectionsParams,
  ): Promise<SelectionsListResponseDto> {
    const { page, perPage, worldcupId } = params;

    // 🔹 Generate Cache Key
    const cacheKey = `selections:worldcup:${worldcupId}:page:${page}:perPage:${perPage}`;

    // 🔹 Check Cache First
    const cachedData = await this.redisService.getValue(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const [selectionsData, total] = await Promise.all([
      this.selectionsRepository.find({
        where: { game: { id: worldcupId }, deletedAt: null },
        take: perPage,
        skip: perPage * (page - 1),
        order: {
          finalWinLossRatio: 'DESC',
          winLossRatio: 'DESC',
        },
      }),
      this.selectionsRepository.count({
        where: { game: { id: worldcupId }, deletedAt: null },
      }),
    ]);

    // 🔹 Add Ranking Field
    const selections = selectionsData.map((selection, index) => ({
      ...selection,
      ranking: index + 1 + (page - 1) * perPage,
    }));

    const response = plainToInstance(
      SelectionsListResponseDto,
      {
        page,
        perPage,
        data: selections,
        total,
      },
      { excludeExtraneousValues: true },
    );

    // 🔹 Cache the Data (Expire after 10 minutes)
    await this.redisService.setValue(cacheKey, JSON.stringify(response), 600);

    return response;
  }

  async getSelectionsForEdit(
    params: GetSelectionsForEditParams,
  ): Promise<SelectionsListResponseDto> {
    const { page, perPage, worldcupId, keyword } = params;

    const whereCondition: any = {
      game: { id: worldcupId },
      deletedAt: null,
    };

    // ✅ Add keyword search if provided (wildcard case-insensitive search)
    if (keyword) {
      whereCondition.name = ILike(`%${keyword}%`);
    }

    const data = await this.selectionsRepository.findAndCount({
      where: whereCondition,
      take: perPage,
      skip: perPage * (page - 1),
      order: { createdAt: 'DESC' },
    });

    return plainToInstance(
      SelectionsListResponseDto,
      {
        page,
        perPage,
        data: data[0],
        total: data[1],
      },
      { excludeExtraneousValues: true },
    );
  }

  async createSelectionWithImage(
    fileName: string,
    worldcupId: string,
    fileUrl: string,
    userFromToken: UserFromToken,
  ) {
    const game = await this.gamesRepository.findOne({
      where: { id: Number(worldcupId), user: { id: userFromToken.userId } },
    });
    if (!game) {
      throw new Error('Game not found');
    }

    try {
      const selection = this.selectionsRepository.create({
        name: fileName.slice(0, fileName.lastIndexOf('.')),
        game: { id: game.id },
        isVideo: false,
        resourceUrl: fileUrl,
      });

      const createdSelection = await this.selectionsRepository.save(selection);

      await this.redisService.deleteKeysByPattern(
        `selections:worldcup:${game.id}:*`,
      );
      return createdSelection;
    } catch (error) {
      throw new Error(error);
    }
  }

  async createSelectionWithVideo(
    body: CreateSelectionWithVideoBodyDto,
    userFromToken: UserFromToken,
  ) {
    const { resourceUrl, worldcupId, startTime, endTime } = body;
    const game = await this.gamesRepository.findOne({
      where: { id: Number(worldcupId), user: { id: userFromToken.userId } },
    });
    if (!game) {
      throw new Error('Game not found');
    }

    let parsedUrl = '';
    let videoId = '';

    try {
      videoId = this.getYouTubeVideoId(resourceUrl);
      parsedUrl = `https://www.youtube.com/embed/${videoId}`;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new Error('Failed to parse YouTube URL');
    }

    let title = '';
    try {
      title = await this.getYouTubeVideoTitle(videoId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Do nothing
    }

    try {
      const selection = this.selectionsRepository.create({
        name: title,
        game: { id: game.id },
        isVideo: true,
        videoSource: 'youtube',
        videoUrl: parsedUrl,
        resourceUrl: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
        startTime,
        endTime,
      });
      const createSelection = await this.selectionsRepository.save(selection);
      await this.redisService.deleteKeysByPattern(
        `selections:worldcup:${game.id}:*`,
      );
      return createSelection;
    } catch (error) {
      throw new Error(error);
    }
  }

  async getYouTubeVideoTitle(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
      );
      const html = await response.text();

      // Extract title using regex
      const match = html.match(/<title>(.*?)<\/title>/);
      if (match && match[1]) {
        return match[1].replace(' - YouTube', '').trim(); // Clean title
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch YouTube title:', error);
      return null;
    }
  }

  getYouTubeVideoId(url: string): string | null {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);

    if (match && match[7].length === 11) {
      return match[7];
    }

    throw new Error('Failed to parse YouTube URL');
  }

  async updateSelectionName(
    body: UpdateSelectionBodyDto,
    userFromToken: UserFromToken,
  ): Promise<SelectionResponseDto> {
    const { gameId, selectionId, name, resourceUrl } = body;

    const game = await this.gamesRepository.findOne({
      where: {
        id: gameId,
        user: { id: userFromToken.userId },
        deletedAt: null,
      },
    });
    if (!game) {
      throw new Error('Game not found');
    }

    const selection = await this.selectionsRepository.findOne({
      where: { id: selectionId, game: { id: game.id } },
    });
    if (!selection) {
      throw new Error('Selection not found');
    }

    selection.name = name;
    selection.resourceUrl = resourceUrl;

    // ✅ Use scan-based deletion to prevent Redis from slowing down
    await this.redisService.deleteKeysByPattern(
      `selections:worldcup:${gameId}:*`,
    );

    return plainToInstance(
      SelectionResponseDto,
      await this.selectionsRepository.save(selection),
      { excludeExtraneousValues: true },
    );
  }

  async deleteSelection(id: number, userFromToken: UserFromToken) {
    const selection = await this.selectionsRepository.findOne({
      where: { id },
      relations: ['game'],
    });
    if (!selection) {
      throw new NotFoundException('Selection not found');
    }

    const game = await this.gamesRepository.findOne({
      where: { id: selection.game.id, user: { id: userFromToken.userId } },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    selection.deletedAt = new Date();
    const deleteResult = await this.selectionsRepository.save(selection);

    await this.redisService.deleteKeysByPattern(
      `selections:worldcup:${selection.game.id}:*`,
    );

    return deleteResult;
  }
}
