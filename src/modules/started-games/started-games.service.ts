import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StartedGamesRepository } from './started-games.repository';
import { CreateStartedGameDto } from './dtos/create-started-game.dto';
import { CreatePickDto } from './dtos/create-pick.dto';
import { MatchesRepository } from './matches.repository';
import { plainToInstance } from 'class-transformer';
import { StartedGameResponseDto } from './dtos/started-game-response.dto';
import { DataSource, IsNull, Not } from 'typeorm';
import { Match } from './entities/match.entity';
import { AddResultImage } from './dtos/add-result-image-dto';
import { GetStartedGameParamsDto } from './dtos/get-started-game-params.dto';
import { StartedGameResultResponseDto } from './dtos/started-game-result-response.dto';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { GetStartedGamesQueryDto } from './dtos/get-started-games-query.dto';
import { StartedGameWithGameDto } from './dtos/started-game-with-game.dto';
import { GetStartedGameWithoutSlugParamsDto } from './dtos/get-started-game-without-slug-params.dto';
import { StartedGame } from './entities/started-game.entity';

@Injectable()
export class StartedGamesService {
  constructor(
    private readonly startedGamesRepository: StartedGamesRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly dataSource: DataSource,
  ) {}

  async getStartedGames(
    user: UserFromToken,
    query: GetStartedGamesQueryDto,
  ): Promise<StartedGameWithGameDto[]> {
    const { page = 1, perPage = 10 } = query;
    const skip = (page - 1) * perPage;

    const startedGames = await this.startedGamesRepository.find({
      where: { user: { id: user.userId }, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      relations: ['game'],
      skip,
      take: perPage,
    });

    return plainToInstance(StartedGameWithGameDto, startedGames, {
      excludeExtraneousValues: true,
    });
  }

  async createStartedGame(
    createStartedGameDto: CreateStartedGameDto,
    user: UserFromToken,
  ) {
    const { gameId, roundsOf } = createStartedGameDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const gameResult = await queryRunner.manager.query(
        `SELECT * FROM games WHERE "id" = $1 AND "visibility" <> 'IS_CLOSED'`,
        [gameId],
      );
      const game = gameResult[0];

      await queryRunner.manager.query(
        `UPDATE games SET "plays" = "plays" + 1 WHERE "id" = $1`,
        [gameId],
      );

      const startedGameInsert = await queryRunner.manager.query(
        `INSERT INTO started_games ("gameId", "roundsOf", "userId", "status") 
         VALUES ($1, $2, $3, 'IN_PROGRESS') RETURNING *`,
        [game.id, roundsOf, user ? user.userId : null],
      );
      const startedGame = startedGameInsert[0];

      const selections = await queryRunner.manager.query(
        `SELECT * FROM selections WHERE "gameId" = $1 AND "deletedAt" IS NULL`,
        [gameId],
      );

      if (selections.length < 2) {
        throw new Error('Not enough selections to start a match.');
      }

      this.fisherYatesShuffle(selections);

      const total = selections.length;
      const nextPower = this.getNextPowerOfTwo(total);
      let byeSelections = [];
      let firstRoundCandidates = selections;
      let byesCount = 0;

      // Only assign byes if roundsOf is enough to support next power-of-two format
      if (roundsOf >= nextPower) {
        const byesNeeded = nextPower - total;
        byeSelections = selections.slice(0, byesNeeded);
        firstRoundCandidates = selections.slice(byesNeeded);

        // Create bye matches
        for (const selection of byeSelections) {
          await queryRunner.manager.insert(Match, {
            startedGameId: startedGame.id,
            roundsOf,
            selection1Id: selection.id,
            selection2Id: null,
            winnerId: selection.id,
          });
          byesCount++;
        }
      }

      // Create only the first playable match
      if (firstRoundCandidates.length >= 2) {
        const sel1 = firstRoundCandidates[0];
        const sel2 = firstRoundCandidates[1];

        await queryRunner.manager.insert(Match, {
          startedGameId: startedGame.id,
          roundsOf,
          selection1Id: sel1.id,
          selection2Id: sel2.id,
        });
      }

      await queryRunner.commitTransaction();

      const firstMatch = await this.matchesRepository.findOne({
        where: {
          startedGameId: startedGame.id,
          roundsOf,
          selection2Id: Not(IsNull()),
        },
        order: { id: 'ASC' },
        relations: ['selection1', 'selection2'],
      });

      return plainToInstance(
        StartedGameResponseDto,
        {
          startedGame,
          match: firstMatch,
          matchNumberInRound: byesCount + 1,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createPick(createPickDto: CreatePickDto) {
    const { startedGameId, matchId, pickedSelectionId } = createPickDto;

    if (!pickedSelectionId || isNaN(pickedSelectionId as any)) {
      throw new BadRequestException('Invalid picked selection ID');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const startedGamesRepo = queryRunner.manager.getRepository(StartedGame);
    const matchesRepo = queryRunner.manager.getRepository(Match);

    try {
      // 1) startedGame
      const startedGame = await startedGamesRepo.findOne({
        where: { id: startedGameId },
      });
      if (!startedGame) throw new NotFoundException('Started game not found');

      // 2) match lock (FOR UPDATE)
      const match = await matchesRepo
        .createQueryBuilder('m')
        .where('m.id = :id', { id: matchId })
        .setLock('pessimistic_write')
        .getOne();

      if (!match) throw new NotFoundException('Match not found');
      if (match.startedGameId !== startedGameId) {
        throw new BadRequestException('Match not in the started game');
      }

      if (match.winnerId)
        throw new BadRequestException('Match already has a winner');

      if (
        match.selection1Id !== pickedSelectionId &&
        match.selection2Id !== pickedSelectionId
      ) {
        throw new BadRequestException('Selection not in the match');
      }

      const loserSelectionId =
        match.selection1Id === pickedSelectionId
          ? match.selection2Id
          : match.selection1Id;

      // 3) winnerId 원자 업데이트
      const upd = await matchesRepo
        .createQueryBuilder()
        .update(Match)
        .set({ winnerId: pickedSelectionId })
        .where('"id" = :id AND "winnerId" IS NULL', { id: match.id })
        .execute();

      if (!upd.affected) {
        throw new BadRequestException('Match already has a winner');
      }
      match.winnerId = pickedSelectionId;

      // 4) wins/losses 원자 증가 (raw SQL - 타입/버전 안전)
      await queryRunner.manager.query(
        `UPDATE selections SET "wins" = COALESCE("wins",0) + 1 WHERE "id" = $1`,
        [pickedSelectionId],
      );
      await queryRunner.manager.query(
        `UPDATE selections SET "losses" = COALESCE("losses",0) + 1 WHERE "id" = $1`,
        [loserSelectionId],
      );

      // 5) 원래 로직 유지: matchesCount
      const matchesCount = await matchesRepo.count({
        where: { startedGameId, roundsOf: match.roundsOf },
      });

      const roundEnded = matchesCount === match.roundsOf / 2;
      const previousRoundsOf = roundEnded ? match.roundsOf : match.roundsOf * 2;
      const currentRoundsOf = roundEnded ? match.roundsOf / 2 : match.roundsOf;
      const matchesCountForResponse = roundEnded ? 1 : matchesCount + 1;

      // 6) Final round
      if (currentRoundsOf === 1) {
        startedGame.status = 'IS_COMPLETED' as any;

        await queryRunner.manager.query(
          `UPDATE started_games SET "status" = 'IS_COMPLETED' WHERE "id" = $1`,
          [startedGameId],
        );

        // finalWins/finalLosses 원자 증가
        await queryRunner.manager.query(
          `UPDATE selections SET "finalWins" = COALESCE("finalWins",0) + 1 WHERE "id" = $1`,
          [pickedSelectionId],
        );
        await queryRunner.manager.query(
          `UPDATE selections SET "finalLosses" = COALESCE("finalLosses",0) + 1 WHERE "id" = $1`,
          [loserSelectionId],
        );

        await queryRunner.manager.query(
          `UPDATE games SET "finishedPlays" = "finishedPlays" + 1 WHERE "id" = $1`,
          [startedGame.gameId],
        );

        // await this.updateStatsSafely(
        //   queryRunner,
        //   pickedSelectionId,
        //   loserSelectionId,
        //   true,
        // );

        await queryRunner.commitTransaction();

        return plainToInstance(
          StartedGameResponseDto,
          { startedGame, previousMatch: match },
          { excludeExtraneousValues: true },
        );
      }

      // 7) 다음 라운드 후보(원래 로직 유지)
      let candidates: number[];

      if (previousRoundsOf === startedGame.roundsOf * 2) {
        const rows: Array<{ id: number }> = await queryRunner.manager.query(
          `SELECT id FROM selections WHERE "gameId" = $1 AND "deletedAt" IS NULL`,
          [startedGame.gameId],
        );
        candidates = rows.map((r) => r.id);
      } else {
        const rows: Array<{ winnerId: number }> =
          await queryRunner.manager.query(
            `SELECT "winnerId" FROM matches
         WHERE "startedGameId" = $1 AND "roundsOf" = $2 AND "winnerId" IS NOT NULL`,
            [startedGameId, previousRoundsOf],
          );
        candidates = rows.map((r) => r.winnerId);
      }

      const excludedRows: Array<{
        selection1Id: number;
        selection2Id: number;
      }> = await queryRunner.manager.query(
        `SELECT "selection1Id", "selection2Id" FROM matches
         WHERE "startedGameId" = $1 AND "roundsOf" = $2`,
        [startedGameId, currentRoundsOf],
      );

      const excludedIds = new Set<number>();
      for (const row of excludedRows) {
        if (row.selection1Id) excludedIds.add(row.selection1Id);
        if (row.selection2Id) excludedIds.add(row.selection2Id);
      }

      const availableCandidates = candidates.filter(
        (id) => !excludedIds.has(id),
      );

      if (availableCandidates.length < 2) {
        throw new Error('Not enough selections for next match.');
      }

      this.fisherYatesShuffle(availableCandidates);
      const randomTwoSelections = availableCandidates.slice(0, 2);

      // 8) 새 match 생성: 타입 문제 피하려고 FK로만 저장
      const inserted = await matchesRepo.save(
        matchesRepo.create({
          startedGameId,
          roundsOf: currentRoundsOf,
          selection1Id: randomTwoSelections[0],
          selection2Id: randomTwoSelections[1],
        }),
      );

      // await this.updateStatsSafely(
      //   queryRunner,
      //   pickedSelectionId,
      //   loserSelectionId,
      //   false,
      // );

      await queryRunner.commitTransaction();

      // ✅ 프론트 호환: 응답 직전에 relations 포함해서 다시 조회해서 match shape 맞추기
      const newMatch = await this.matchesRepository.findOne({
        where: { id: inserted.id },
        relations: {
          selection1: true,
          selection2: true,
        },
      });

      if (!newMatch) throw new Error('New match not found after commit');

      return plainToInstance(
        StartedGameResponseDto,
        {
          startedGame,
          previousMatch: match,
          match: newMatch,
          matchNumberInRound: matchesCountForResponse,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // [최종 수정] NULL 방지 처리만 하면 비율(Ratio)은 DB가 알아서 계산합니다.
  // private async updateStatsSafely(
  //   queryRunner: any,
  //   winnerId: number,
  //   loserId: number,
  //   isFinal: boolean,
  // ) {
  //   const updates = [
  //     { id: winnerId, isWinner: true },
  //     { id: loserId, isWinner: false },
  //   ].sort((a, b) => a.id - b.id);

  //   for (const update of updates) {
  //     if (update.isWinner) {
  //       // wins가 NULL이면 0으로 치환 후 1 더함 -> DB가 감지하고 Ratio 자동 업데이트
  //       let query = `UPDATE selections SET "wins" = COALESCE("wins", 0) + 1`;
  //       if (isFinal) {
  //         query += `, "finalWins" = COALESCE("finalWins", 0) + 1`;
  //       }
  //       query += ` WHERE "id" = $1`;

  //       await queryRunner.manager.query(query, [update.id]);
  //     } else {
  //       // losses가 NULL이면 0으로 치환 후 1 더함 -> DB가 감지하고 Ratio 자동 업데이트
  //       let query = `UPDATE selections SET "losses" = COALESCE("losses", 0) + 1`;
  //       if (isFinal) {
  //         query += `, "finalLosses" = COALESCE("finalLosses", 0) + 1`;
  //       }
  //       query += ` WHERE "id" = $1`;

  //       await queryRunner.manager.query(query, [update.id]);
  //     }
  //   }
  // }

  fisherYatesShuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  async addResultImage(addResultImageDto: AddResultImage) {
    const { startedGameId, imageUrl } = addResultImageDto;

    const startedGame = await this.startedGamesRepository.findOne({
      where: { id: startedGameId },
    });

    if (!startedGame) {
      throw new NotFoundException('Match not found');
    }

    startedGame.resultImage = imageUrl;
    await this.startedGamesRepository.save(startedGame);

    return plainToInstance(
      StartedGameResponseDto,
      { startedGame },
      { excludeExtraneousValues: true },
    );
  }

  async getStartedGame(
    params: GetStartedGameParamsDto,
  ): Promise<StartedGameResultResponseDto> {
    const { id: startedGameId, slug: gameSlug } = params;

    const startedGame = await this.startedGamesRepository.findOne({
      where: { id: startedGameId },
      relations: ['game'],
    });

    if (!startedGame || startedGame.game.slug !== gameSlug) {
      throw new NotFoundException('Started game not found');
    }

    return plainToInstance(StartedGameResultResponseDto, startedGame, {
      excludeExtraneousValues: true,
    });
  }

  async getStartedGameById(
    params: GetStartedGameWithoutSlugParamsDto,
    user: UserFromToken,
  ) {
    const { id: startedGameId } = params;

    // Find the started game with its game relation
    const startedGame = await this.startedGamesRepository.findOne({
      where: { id: startedGameId },
      relations: ['game', 'user'],
    });

    // Check if the started game exists and belongs to the user
    if (!startedGame) {
      throw new NotFoundException('Started game not found');
    }

    if (!startedGame.user || startedGame.user.id !== user.userId) {
      throw new BadRequestException('This started game does not belong to you');
    }

    // Find the latest match for this started game
    const latestMatch = await this.matchesRepository.findOne({
      where: {
        startedGameId,
        selection2Id: Not(IsNull()), // skip bye matches
      },
      order: { createdAt: 'DESC' },
      relations: ['selection1', 'selection2'],
    });

    // Get the count of matches in the current round
    const matchesCount = await this.matchesRepository.count({
      where: {
        startedGameId,
        roundsOf: latestMatch.roundsOf,
        selection2Id: Not(IsNull()), // only real matches, not byes
      },
    });

    // Return a response similar to createPick but without creating a new match
    return plainToInstance(
      StartedGameResponseDto,
      {
        startedGame,
        match: latestMatch,
        matchNumberInRound: matchesCount,
      },
      { excludeExtraneousValues: true },
    );
  }

  async deleteStartedGame(id: number, user: UserFromToken): Promise<void> {
    const res = await this.startedGamesRepository
      .createQueryBuilder()
      .update(StartedGame)
      .set({ deletedAt: () => 'NOW()' })
      .where('id = :id AND "userId" = :uid AND "deletedAt" IS NULL', {
        id,
        uid: user.userId,
      })
      .execute();

    if (!res.affected) {
      throw new NotFoundException('Started game not found');
    }
  }

  getNextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}
