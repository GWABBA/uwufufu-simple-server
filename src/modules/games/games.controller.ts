import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import {
  GetGameBySlugParamsDto,
  GetGameParamsDto,
} from './dtos/get-game-params.dto';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { GameResponseDto } from './dtos/game-response.dto';
import { CreateGameBodyDto } from './dtos/create-game-body-dto';
import { AuthRequest } from '../auth/types/auth-request.interface';
import { GetMyGamesQueryDto } from './dtos/get-my-games-query.dto';
import { GamesListResponseDto } from './dtos/games-list-response.dto';
import { GetGamesQueryDto } from './dtos/get-games-query.dto';
import { UpdateGameBodyDto } from './dtos/update-game-body-dto';
import { MessageResponseDto } from 'src/core/dtos/message-response.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  async getGames(
    @Query() query: GetGamesQueryDto,
  ): Promise<GamesListResponseDto> {
    return this.gamesService.getGames(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Req() req: AuthRequest,
    @Body() createGameBodyDto: CreateGameBodyDto,
  ): Promise<GameResponseDto> {
    const user = req.user;
    return this.gamesService.createGame(createGameBodyDto, user);
  }

  @Get('/:slug/slug')
  async getGameBySlug(@Param() params: GetGameBySlugParamsDto) {
    return this.gamesService.getGameBySlug(params);
  }

  @Get('/mine')
  @UseGuards(JwtAuthGuard)
  async getMyGames(
    @Req() req: AuthRequest,
    @Query() query: GetMyGamesQueryDto,
  ): Promise<GamesListResponseDto> {
    const user = req.user;
    return this.gamesService.getMyGames(query, user);
  }

  @Get('/:id/mine')
  @UseGuards(JwtAuthGuard)
  async getMyGameById(
    @Req() req: AuthRequest,
    @Param() params: GetGameParamsDto,
  ) {
    const user = req.user;
    return this.gamesService.getMyGameById(params, user);
  }

  @Put('/:id')
  @UseGuards(JwtAuthGuard)
  async updateGame(
    @Req() req: AuthRequest,
    @Param() params: GetGameParamsDto,
    @Body() updateGameBodyDto: UpdateGameBodyDto,
  ) {
    const user = req.user;
    return this.gamesService.updateGame(params, updateGameBodyDto, user);
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  async deleteGame(@Req() req: AuthRequest, @Param() params: GetGameParamsDto) {
    const user = req.user;
    return this.gamesService.deleteGame(params, user);
  }

  @Put('/:id/nsfw')
  @UseGuards(JwtAuthGuard)
  async toggleNsfw(
    @Req() req: AuthRequest,
    @Param() params: GetGameParamsDto,
  ): Promise<MessageResponseDto> {
    const user = req.user;
    return this.gamesService.toggleNsfw(params, user);
  }
}
