import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GamesController } from './games.controller';
import { GamesRepository } from './games.repository';
import { GamesService } from './games.service';
import { AuthModule } from '../auth/auth.module';
import { CategoriesRepository } from '../categories/categories.repository';
import { UsersRepository } from '../users/users.repository';
import { Category } from '../categories/entities/category.entity';
import { User } from '../users/entities/user.entity';
import { SelectionsRepository } from '../selections/selections.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Category, User]), AuthModule],
  controllers: [GamesController],
  providers: [
    GamesService,
    GamesRepository,
    CategoriesRepository,
    UsersRepository,
    SelectionsRepository,
  ],
  exports: [GamesService, GamesRepository],
})
export class GamesModule {}
