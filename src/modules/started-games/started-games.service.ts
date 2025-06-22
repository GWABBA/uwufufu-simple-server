import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StartedGamesRepository } from './started-games.repository';
import { SelectionsRepository } from '../selections/selections.repository';
import { CreateStartedGameDto } from './dtos/create-started-game.dto';
import { CreatePickDto } from './dtos/create-pick.dto';
import { MatchesRepository } from './matches.repository';
import { plainToInstance } from 'class-transformer';
import { StartedGameResponseDto } from './dtos/started-game-response.dto';
import { DataSource, In, IsNull, LessThanOrEqual, Not } from 'typeorm';
import { Match } from './entities/match.entity';
import { AddResultImage } from './dtos/add-result-image-dto';
import { GetStartedGameParamsDto } from './dtos/get-started-game-params.dto';
import { StartedGameResultResponseDto } from './dtos/started-game-result-response.dto';
import { UserFromToken } from '../auth/types/auth-request.interface';
import { GetStartedGamesQueryDto } from './dtos/get-started-games-query.dto';
import { StartedGameWithGameDto } from './dtos/started-game-with-game.dto';
import { GetStartedGameWithoutSlugParamsDto } from './dtos/get-started-game-without-slug-params.dto';
import { StartedGame } from './entities/started-game.entity';
import { StartedGameStatus } from 'src/core/enums/startedGameStatus.enum';

@Injectable()
export class StartedGamesService {
  constructor(
    private readonly startedGamesRepository: StartedGamesRepository,
    private readonly selectionsRepository: SelectionsRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly dataSource: DataSource,
  ) {}

  async getStartedGames(user: UserFromToken, query: GetStartedGamesQueryDto): Promise<StartedGameWithGameDto[]> {
    const { page = 1, perPage = 10 } = query;
    const skip = (page - 1) * perPage;
    
    const startedGames = await this.startedGamesRepository.find({
      where: { user: { id: user.userId } },
      order: { createdAt: 'DESC' },
      relations: ['game'],
      skip,
      take: perPage,
      withDeleted: true,
    });
    
    return plainToInstance(StartedGameWithGameDto, startedGames, { excludeExtraneousValues: true });
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
      const byesNeeded = nextPower - total;
  
      const byeSelections = selections.slice(0, byesNeeded);
      const firstRoundCandidates = selections.slice(byesNeeded);

      let byesCount = 0;
  
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

    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const startedGameResult = await queryRunner.manager.query(
        `SELECT * FROM started_games WHERE "id" = $1`,
        [startedGameId],
      );
      const matchResult = await queryRunner.manager.query(
        `SELECT * FROM matches WHERE "id" = $1`,
        [matchId],
      );

      // find started game
      if (startedGameResult.length === 0)
        throw new NotFoundException('Started game not found');
      if (matchResult.length === 0)
        throw new NotFoundException('Match not found');

      const startedGame = startedGameResult[0];
      const match = matchResult[0];

      // check selection id's are valid
      if (!pickedSelectionId || isNaN(pickedSelectionId)) {
        throw new BadRequestException('Invalid picked selection ID');
      }
      if (match.winnerId) {
        throw new BadRequestException('Match already has a winner');
      }
      if (
        match.selection1Id !== pickedSelectionId &&
        match.selection2Id !== pickedSelectionId
      ) {
        throw new BadRequestException('Selection not in the match');
      }

      // ✅ Update match with the winner
      await queryRunner.manager.query(
        `UPDATE matches 
          SET "winnerId" = $1 
          WHERE "id" = $2`,
        [pickedSelectionId, match.id],
      );
      const selectionsResult = await this.selectionsRepository.findBy({
        id: In([
          pickedSelectionId,
          match.selection1Id === pickedSelectionId
            ? match.selection2Id
            : match.selection1Id,
        ]),
      });

      if (selectionsResult.length !== 2) {
        throw new Error('Winner or loser selection not found');
      }

      const winnerSelection = selectionsResult.find(
        (s) => s.id === pickedSelectionId,
      );
      const loserSelection = selectionsResult.find(
        (s) => s.id !== pickedSelectionId,
      );

      if (!winnerSelection || !loserSelection) {
        throw new Error('Selections not found');
      }

      // Ensure valid numbers before updating
      winnerSelection.wins = (winnerSelection.wins || 0) + 1;
      loserSelection.losses = (loserSelection.losses || 0) + 1;

      this.selectionsRepository.save([winnerSelection, loserSelection]);

      // ✅ Check if the round has ended
      const matchesCount = await this.matchesRepository.count({
        where: { startedGameId, roundsOf: match.roundsOf },
      });

      const roundEnded = matchesCount === match.roundsOf / 2;
      const previousRoundsOf = roundEnded ? match.roundsOf : match.roundsOf * 2;
      const currentRoundsOf = roundEnded ? match.roundsOf / 2 : match.roundsOf;
      const matchesCountForResponse = roundEnded ? 1 : matchesCount + 1;

      if (currentRoundsOf === 1) {
        // ✅ Final round: update final wins/losses
        if (winnerSelection) {
          winnerSelection.finalWins = (winnerSelection.finalWins || 0) + 1;
        }
        if (loserSelection) {
          loserSelection.finalLosses = (loserSelection.finalLosses || 0) + 1;
        }

        // ✅ Mark game as completed
        startedGame.status = 'IS_COMPLETED';
        await queryRunner.manager.query(
          `UPDATE started_games SET "status" = 'IS_COMPLETED' WHERE "id" = $1`,
          [startedGameId],
        );

        // ✅ Save final results
        await this.selectionsRepository.update(winnerSelection.id, {
          wins: winnerSelection.wins,
          finalWins: winnerSelection.finalWins,
        });
        
        await this.selectionsRepository.update(loserSelection.id, {
          losses: loserSelection.losses,
          finalLosses: loserSelection.finalLosses,
        });

        // Save number of finished games
        await queryRunner.manager.query(
          `UPDATE games SET "finishedPlays" = "finishedPlays" + 1 WHERE "id" = $1`,
          [startedGame.gameId],
        );

        await queryRunner.commitTransaction();

        return plainToInstance(
          StartedGameResponseDto,
          { startedGame, previousMatch: match },
          { excludeExtraneousValues: true },
        );
      }

      // ✅ Get candidates for the next round
      let candidates;
      if (previousRoundsOf === startedGame.roundsOf * 2) {
        const selectionsResult = await queryRunner.manager.query(
          `SELECT id FROM selections WHERE "gameId" = $1 AND "deletedAt" IS NULL`,
          [startedGame.gameId],
        );
        candidates = selectionsResult.map((selection) => selection.id);
      } else {
        const previousMatchesResult = await queryRunner.manager.query(
          `SELECT "winnerId" FROM matches WHERE "startedGameId" = $1 AND "roundsOf" = $2 AND "winnerId" IS NOT NULL`,
          [startedGameId, previousRoundsOf],
        );
        candidates = previousMatchesResult.map((match) => match.winnerId);
      }

      // ✅ Remove already used selections
      const excludedIds = (
        await this.matchesRepository
          .createQueryBuilder('match')
          .select('match.selection1Id')
          .addSelect('match.selection2Id')
          .where('match.startedGameId = :startedGameId', { startedGameId })
          .andWhere('match.roundsOf = :roundsOf', { roundsOf: currentRoundsOf })
          .getRawMany()
      ).flatMap((row) => [row.match_selection1Id, row.match_selection2Id]);

      const availableCandidates = candidates.filter(
        (id) => !excludedIds.includes(id),
      );

      // ✅ Ensure we have enough candidates
      if (availableCandidates.length < 2) {
        throw new Error('Not enough selections for next match.');
      }

      this.fisherYatesShuffle(availableCandidates);
      const randomTwoSelections = availableCandidates.slice(0, 2);

      const randomTwoSelectionsEntities = await this.selectionsRepository
        .createQueryBuilder('selection')
        .whereInIds(randomTwoSelections)
        .getMany();

      // ✅ Create a new match
      const newMatch = this.matchesRepository.create({
        startedGame,
        roundsOf: currentRoundsOf,
        selection1: randomTwoSelectionsEntities[0],
        selection2: randomTwoSelectionsEntities[1],
      });

      await this.matchesRepository.save(newMatch);
      await queryRunner.commitTransaction();

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

  async getStartedGameById(params: GetStartedGameWithoutSlugParamsDto, user: UserFromToken) {
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

  getNextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}
