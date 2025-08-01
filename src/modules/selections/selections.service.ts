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
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class SelectionsService {
  constructor(
    private readonly selectionsRepository: SelectionsRepository,
    private readonly gamesRepository: GamesRepository,
    private readonly usersRepository: UsersRepository,
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
          finalWins: 'DESC',
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
    const { page, perPage, worldcupId, keyword, sortBy } = params;

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
      order: { [sortBy]: 'DESC' },
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

      this.redisService
        .deleteKeysByPattern(`selections:worldcup:${game.id}:*`)
        .catch((err) => {
          console.error('[Redis] Failed to deleteKeysByPattern:', err);
        });

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
      this.redisService
        .deleteKeysByPattern(`selections:worldcup:${game.id}:*`)
        .catch((err) => {
          console.error('[Redis] Failed to deleteKeysByPattern:', err);
        });

      return createSelection;
    } catch (error) {
      throw new Error(error);
    }
  }

  async getYouTubeVideoTitle(videoId: string): Promise<string | null> {
    const maxRetries = 2;

    for (let i = 0; i <= maxRetries; i++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000); // 1 second

      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: controller.signal },
        );

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(
            `YouTube oEmbed request failed with status ${response.status}`,
          );
        }

        const data = await response.json();
        return data.title;
      } catch (error: any) {
        clearTimeout(timeout);

        if (i === maxRetries) {
          console.error(
            '❌ Failed to fetch YouTube title after retries:',
            error,
          );
          return null;
        }

        console.warn(
          `[YouTube Retry] Attempt ${i + 1} failed: ${error.message}`,
        );
        await new Promise((res) => setTimeout(res, 300 * (i + 1))); // retry delay
      }
    }

    return null;
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
    const {
      gameId,
      selectionId,
      name,
      resourceUrl,
      startTime,
      endTime,
      videoUrl,
    } = body;

    let game = null;

    game = await this.gamesRepository.findOne({
      where: {
        id: gameId,
        user: { id: userFromToken.userId },
        deletedAt: null,
      },
    });

    if (!game) {
      const userEntity = await this.usersRepository.findOne({
        where: { id: userFromToken.userId },
      });

      if (!userEntity || !userEntity.isAdmin) {
        throw new NotFoundException('Game not found');
      }

      game = await this.gamesRepository.findOne({
        where: { id: gameId, deletedAt: null },
      });
    }

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
    if (selection.isVideo) {
      if (startTime) selection.startTime = startTime;
      if (endTime) selection.endTime = endTime;
      if (videoUrl && videoUrl !== selection.videoUrl) {
        const videoId = this.getYouTubeVideoId(videoUrl);
        selection.videoUrl = `https://www.youtube.com/embed/${videoId}`;
        selection.resourceUrl = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
      }
    }

    this.redisService
      .deleteKeysByPattern(`selections:worldcup:${gameId}:*`)
      .catch((err) => {
        console.error('[Redis] Failed to deleteKeysByPattern:', err);
      });

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

    let game = null;

    game = await this.gamesRepository.findOne({
      where: { id: selection.game.id, user: { id: userFromToken.userId } },
    });

    if (!game) {
      const userEntity = await this.usersRepository.findOne({
        where: { id: userFromToken.userId },
      });

      if (!userEntity || !userEntity.isAdmin) {
        throw new NotFoundException('Game not found');
      }

      game = await this.gamesRepository.findOne({
        where: { id: selection.game.id, deletedAt: null },
      });
    }

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    selection.deletedAt = new Date();
    const deleteResult = await this.selectionsRepository.save(selection);

    this.redisService
      .deleteKeysByPattern(`selections:worldcup:${selection.game.id}:*`)
      .catch((err) => {
        console.error('Redis error:', err);
      });

    return deleteResult;
  }
}
