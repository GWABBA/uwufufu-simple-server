import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { StartedGamesService } from './started-games.service';
import { CreateStartedGameDto } from './dtos/create-started-game.dto';
import { CreatePickDto } from './dtos/create-pick.dto';
import { AddResultImage } from './dtos/add-result-image-dto';
import { GetStartedGameParamsDto } from './dtos/get-started-game-params.dto';

@Controller('started-games')
export class StartedGamesController {
  constructor(private readonly startedGamesService: StartedGamesService) {}

  @Post()
  async createStartedGame(@Body() createStartedGameDto: CreateStartedGameDto) {
    return await this.startedGamesService.createStartedGame(
      createStartedGameDto,
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
}
