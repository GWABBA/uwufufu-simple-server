import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersRepository } from '../users/users.repository';
import { Selection } from '../selections/entities/selection.entity';
import { User } from '../users/entities/user.entity';
import { SelectionsService } from './selections.service';
import { SelectionsRepository } from './selections.repository';
import { Game } from '../games/entities/game.entity';
import { SelectionsController } from './selections.controller';
import { GamesRepository } from '../games/games.repository';
import { S3Service } from 'src/core/s3/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([Selection, Game, User]), AuthModule],
  controllers: [SelectionsController],
  providers: [
    SelectionsService,
    SelectionsRepository,
    GamesRepository,
    UsersRepository,
    S3Service,
  ],
  exports: [SelectionsService, SelectionsRepository],
})
export class SelectionsModule {}
