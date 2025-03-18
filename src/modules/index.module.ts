import { Module } from '@nestjs/common';
import { StartedGamesModule } from './started-games/started-games.module';
import { GamesModule } from './games/games.module';
import { CategoriesModule } from './categories/categories.module';
import { ImagesModule } from './images/images.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { SelectionsModule } from './selections/selections.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PasswordResetModule,
    StartedGamesModule,
    GamesModule,
    CategoriesModule,
    ImagesModule,
    SelectionsModule,
    PaymentsModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    PasswordResetModule,
    StartedGamesModule,
    GamesModule,
    CategoriesModule,
    ImagesModule,
    SelectionsModule,
    PaymentsModule,
  ],
})
export class IndexModule {}
