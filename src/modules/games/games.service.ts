import { GetGamesQueryDto } from './dtos/get-games-query.dto';
import { UsersRepository } from './../users/users.repository';
import { plainToInstance } from 'class-transformer';
import { Injectable, NotFoundException } from '@nestjs/common';
import { GamesRepository } from './games.repository';
import {
  GetGameBySlugParamsDto,
  GetGameParamsDto,
} from './dtos/get-game-params.dto';
import { GameResponseDto } from './dtos/game-response.dto';
import { CreateGameBodyDto } from './dtos/create-game-body-dto';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { generateUniqueSlug } from 'src/core/utils/slug.util';
import { CategoriesRepository } from '../categories/categories.repository';
import { GetMyGamesQueryDto } from './dtos/get-my-games-query.dto';
import { ILike, Not } from 'typeorm';
import { GamesListResponseDto } from './dtos/games-list-response.dto';
import { Visibility } from 'src/core/enums/visibility.enum';
import { SelectionsRepository } from '../selections/selections.repository';
import { RedisService } from 'src/core/redis/redis.service';
import { UpdateGameBodyDto } from './dtos/update-game-body-dto';

@Injectable()
export class GamesService {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly selectionsRepository: SelectionsRepository,
    private readonly redisService: RedisService,
  ) {}

  async getGames(query: GetGamesQueryDto): Promise<GamesListResponseDto> {
    const { page, perPage, sortBy, search, categories, locale, includeNsfw } =
      query;

    // ✅ Normalize input: Sort arrays to ensure consistent cache keys
    const sortedCategories = categories ? [...categories].sort().join(',') : '';
    const sortedLocale = locale ? [...locale].sort().join(',') : '';

    // ✅ Create a unique and consistent cache key
    const cacheKey = `games:page=${page}:perPage=${perPage}:sort=${sortBy}:search=${search || ''}:categories=${sortedCategories}:locale=${sortedLocale}:nsfw=${includeNsfw}`;

    // ✅ Try fetching from cache first
    const cachedData = await this.redisService.getValue(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData); // ✅ Return cached response
    }

    // 🔹 Base QueryBuilder for fetching actual game data
    const queryBuilder = this.gamesRepository
      .createQueryBuilder('game')
      .leftJoinAndSelect('game.user', 'user')
      .leftJoinAndSelect('game.category', 'category')
      .where('game.deletedAt IS NULL')
      .andWhere('game.visibility = :visibility', {
        visibility: Visibility.IsPublic,
      });

    // 🔹 Filtering
    if (search) {
      queryBuilder.andWhere('game.title ILIKE :search', {
        search: `%${search}%`,
      });
    }
    if (includeNsfw === false) {
      queryBuilder.andWhere('game.isNsfw = false');
    }
    if (categories?.length) {
      queryBuilder.andWhere('game.categoryId IN (:...categories)', {
        categories,
      });
    }
    if (locale?.length) {
      queryBuilder.andWhere('game.locale IN (:...locale)', { locale });
    }

    // 🔹 Sorting
    let sortByColumn = 'game.createdAt';
    if (sortBy === 'popularity') {
      sortByColumn = 'game.plays';
    }
    queryBuilder.orderBy(sortByColumn, 'DESC');

    // 🔹 Pagination
    queryBuilder.skip((page - 1) * perPage).take(perPage);

    const games = await queryBuilder.getMany();

    // 🔹 Separate QueryBuilder for Count (No Joins)
    const countQueryBuilder = this.gamesRepository
      .createQueryBuilder('game')
      .where('game.deletedAt IS NULL')
      .andWhere('game.visibility = :visibility', {
        visibility: Visibility.IsPublic,
      });

    if (search) {
      countQueryBuilder.andWhere('game.title ILIKE :search', {
        search: `%${search}%`,
      });
    }
    if (includeNsfw === false) {
      countQueryBuilder.andWhere('game.isNsfw = false');
    }
    if (categories?.length) {
      countQueryBuilder.andWhere('game.categoryId IN (:...categories)', {
        categories,
      });
    }
    if (locale?.length) {
      countQueryBuilder.andWhere('game.locale IN (:...locale)', { locale });
    }

    const total = await countQueryBuilder.getCount();

    // ✅ Construct Response
    const response = plainToInstance(
      GamesListResponseDto,
      {
        page,
        perPage,
        total,
        worldcups: games,
      },
      { excludeExtraneousValues: true },
    );

    // ✅ Store in cache (TTL: 300 seconds = 5 minutes)
    await this.redisService.setValue(cacheKey, JSON.stringify(response), 300);

    return response;
  }

  async createGame(
    createGameBodyDto: CreateGameBodyDto,
    userFromToken: UserFromToken,
  ): Promise<GameResponseDto> {
    const {
      title,
      description,
      // visibility,
      // isNsfw,
      // categoryId,
      coverImage,
      // locale,
    } = createGameBodyDto;

    // find user
    const user = await this.usersRepository.findOne({
      where: {
        id: userFromToken.userId,
      },
    });
    if (!user) {
      throw new Error('User not found'); // Better to throw a custom exception
    }

    // find
    // don't set category when creating a game
    // const category = await this.categoriesRepository.findOne({
    //   where: {
    //     id: categoryId,
    //   },
    // });
    // if (!category) {
    //   throw new Error('Category not found'); // Better to throw a custom exception
    // }

    // Check if a slug already exists in the database
    const checkSlugExists = async (slug: string): Promise<boolean> => {
      const existingGame = await this.gamesRepository.findOne({
        where: { slug },
      });
      return !!existingGame;
    };

    // Generate a unique slug
    const slug = await generateUniqueSlug(title, user.name, checkSlugExists);

    // Save the game to the database
    const game = this.gamesRepository.create({
      title,
      description,
      visibility: Visibility.IsClosed,
      // isNsfw,
      // category,
      coverImage,
      slug,
      user,
      // locale,
    });
    await this.gamesRepository.save(game);

    return plainToInstance(GameResponseDto, game, {
      excludeExtraneousValues: true,
    });
  }

  async getGameBySlug(
    params: GetGameBySlugParamsDto,
  ): Promise<GameResponseDto> {
    const { slug } = params;
    const cacheKey = `game:${slug}`;

    // 🔹 1. Try fetching from cache
    const cachedGame = await this.redisService.getValue(cacheKey);
    if (cachedGame) {
      return JSON.parse(cachedGame);
    }

    // 🔹 2. Fetch from database
    const game = await this.gamesRepository.findOne({
      where: {
        slug,
        deletedAt: null,
        visibility: Not(Visibility.IsClosed),
      },
      relations: ['user', 'category'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // 🔹 3. Get selections count
    const selectionsCount = await this.selectionsRepository.count({
      where: {
        game: { id: game.id },
        deletedAt: null,
      },
    });

    // 🔹 4. Create response DTO
    const response = plainToInstance(
      GameResponseDto,
      { ...game, selectionsCount },
      { excludeExtraneousValues: true },
    );

    // 🔹 5. Store in cache with TTL (e.g., 10 minutes)
    await this.redisService.setValue(cacheKey, JSON.stringify(response), 600);

    return response;
  }

  async getMyGames(
    getMyGamesQueryDto: GetMyGamesQueryDto,
    userFromToken: UserFromToken,
  ): Promise<GamesListResponseDto> {
    const { page, perPage, search } = getMyGamesQueryDto;

    const whereConditions: any = {
      user: { id: userFromToken.userId },
      deletedAt: null,
    };

    if (search) {
      whereConditions.title = ILike(`%${search}%`); // ✅ Case-insensitive search
    }

    // ✅ Get paginated results + total count
    const [games, total] = await this.gamesRepository.findAndCount({
      where: whereConditions,
      take: perPage,
      skip: perPage * (page - 1),
      relations: ['user', 'category'],
      order: { createdAt: 'DESC' },
    });

    return plainToInstance(
      GamesListResponseDto,
      {
        page,
        perPage,
        worldcups: games, // ✅ Same paginated results
        total, // ✅ Total count of all matching records
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  async getMyGameById(
    getGameParamsDto: GetGameParamsDto,
    userFromToken: UserFromToken,
  ): Promise<GameResponseDto> {
    const { id } = getGameParamsDto;

    const game = await this.gamesRepository.findOne({
      where: {
        id: Number(id),
        user: { id: userFromToken.userId }, // ✅ Correct way to reference relations
        deletedAt: null,
      },
      relations: ['user', 'category'], // ✅ Load necessary relations
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return plainToInstance(GameResponseDto, game, {
      excludeExtraneousValues: true,
    });
  }

  async updateGame(
    getGameParamsDto: GetGameParamsDto,
    createGameBodyDto: UpdateGameBodyDto,
    userFromToken: UserFromToken,
  ): Promise<GameResponseDto> {
    const { id } = getGameParamsDto;
    const {
      title,
      description,
      visibility,
      isNsfw,
      categoryId,
      coverImage,
      locale,
    } = createGameBodyDto;

    const game = await this.gamesRepository.findOne({
      where: {
        id: Number(id),
        user: { id: userFromToken.userId },
        deletedAt: null,
      },
      relations: ['user', 'category'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    console.log(categoryId);
    // 🔹 Find Category
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // 🔹 Update Game Fields
    game.title = title;
    game.description = description;
    game.visibility = visibility;
    game.isNsfw = isNsfw;
    game.category = category;
    game.coverImage = coverImage;
    game.locale = locale;

    await this.gamesRepository.save(game);

    // 🔹 Cache Invalidation
    const cacheKey = `game:${game.slug}`;
    await this.redisService.deleteKey(cacheKey); // ✅ Delete cache after update

    return plainToInstance(GameResponseDto, game, {
      excludeExtraneousValues: true,
    });
  }
}
