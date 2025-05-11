import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StartedGamesService } from './started-games.service';
import { CreateStartedGameDto } from './dtos/create-started-game.dto';
import { CreatePickDto } from './dtos/create-pick.dto';
import { AddResultImage } from './dtos/add-result-image-dto';
import { GetStartedGameParamsDto } from './dtos/get-started-game-params.dto';
import { OptionalJwtAuthGuard } from 'src/core/guards/optional-jwt-auth.guard';
import { AuthRequest } from '../auth/types/auth-request.interface';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { GetStartedGamesQueryDto } from './dtos/get-started-games-query.dto';
import { GetStartedGameWithoutSlugParamsDto } from './dtos/get-started-game-without-slug-params.dto';

@Controller('started-games')
export class StartedGamesController {
  constructor(private readonly startedGamesService: StartedGamesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getStartedGames(@Req() req: AuthRequest, @Query() query: GetStartedGamesQueryDto ) {
    const user = req.user;
    return await this.startedGamesService.getStartedGames(user,query);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async createStartedGame(
    @Req() req: AuthRequest,
    @Body() createStartedGameDto: CreateStartedGameDto,
  ) {
    const user = req.user;
    return await this.startedGamesService.createStartedGame(
      createStartedGameDto,
      user,
    );
  }

  @Post('pick')
  async createPick(@Body() createPickDto: CreatePickDto) {
    return await this.startedGamesService.createPick(createPickDto);
  }

  @Patch('add-result-image')
  async addResultImage(@Body() addResultImageDto: AddResultImage) {
    return await this.startedGamesService.addResultImage(addResultImageDto);
  }

  @Get('/:id/:slug/result')
  async getStartedGame(@Param() params: GetStartedGameParamsDto) {
    return await this.startedGamesService.getStartedGame(params);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  async getStartedGameById(
    @Req() req: AuthRequest,
    @Param() params: GetStartedGameWithoutSlugParamsDto) {
    const user = req.user;
    return await this.startedGamesService.getStartedGameById(params, user);
  }
}
