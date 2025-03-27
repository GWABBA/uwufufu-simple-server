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
import { DataSource, In } from 'typeorm';
import { Match } from './entities/match.entity';
import { AddResultImage } from './dtos/add-result-image-dto';
import { GetStartedGameParamsDto } from './dtos/get-started-game-params.dto';
import { StartedGameResultResponseDto } from './dtos/started-game-result-response.dto';

@Injectable()
export class StartedGamesService {
  constructor(
    private readonly startedGamesRepository: StartedGamesRepository,
    private readonly selectionsRepository: SelectionsRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly dataSource: DataSource,
  ) {}

  async createStartedGame(createStartedGameDto: CreateStartedGameDto) {
    const { gameId, roundsOf } = createStartedGameDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(); // ✅ Start Transaction

    try {
      // ✅ Optimized: Find the game
      const gameResult = await queryRunner.manager.query(
        `SELECT * FROM games WHERE "id" = $1 AND "visibility" <> 'IS_CLOSED'`,
        [gameId],
      );
      const game = gameResult[0];

      // ✅ Optimized: Update plays in a single query
      await queryRunner.manager.query(
        `UPDATE games SET "plays" = "plays" + 1 WHERE "id" = $1`,
        [gameId],
      );

      // ✅ Optimized: Insert `startedGame`
      const startedGameInsert = await queryRunner.manager.query(
        `INSERT INTO started_games ("gameId", "roundsOf", "status") 
         VALUES ($1, $2, 'IN_PROGRESS') RETURNING *`,
        [game.id, roundsOf],
      );
      const startedGame = startedGameInsert[0]; // Get started game object

      // ✅ Keep selection logic the same for now
      const randomTwoSelections = await queryRunner.manager.query(
        `SELECT * FROM selections WHERE "gameId" = $1 
         AND "deletedAt" IS NULL 
         AND ctid IN (
           SELECT ctid FROM selections WHERE "gameId" = $1 AND "deletedAt" IS NULL ORDER BY RANDOM() LIMIT 2
         )`,
        [gameId],
      );

      if (randomTwoSelections.length < 2) {
        throw new Error('Not enough selections to start a match.');
      }

      // ✅ Creating match object (no change needed)
      const match = queryRunner.manager.create(Match, {
        roundsOf,
        selection1: randomTwoSelections[0],
        selection2: randomTwoSelections[1],
        startedGame,
      });
      await queryRunner.manager.save(match);

      // ✅ Commit Transaction
      await queryRunner.commitTransaction();
      return plainToInstance(
        StartedGameResponseDto,
        { startedGame, match, matchNumberInRound: 1 },
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
        await this.selectionsRepository.save([winnerSelection, loserSelection]);

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
}
