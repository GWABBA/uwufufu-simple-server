import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { Report } from './entities/report.entity';
import { GamesRepository } from '../games/games.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Report]), AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository, GamesRepository],
  exports: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
