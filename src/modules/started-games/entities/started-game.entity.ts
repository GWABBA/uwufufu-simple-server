import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Game } from 'src/modules/games/entities/game.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { StartedGameStatus } from 'src/core/enums/startedGameStatus.enum';
import { Match } from './match.entity';

@Entity('started_games')
export class StartedGame {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, (game) => game.startedGames, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' }) // Specifies the foreign key column name
  game: Game; // Reference to the Game entity

  @Column()
  gameId: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' }) // Specifies the foreign
  user: User;

  @Column({ nullable: true })
  resultImage: string;

  @Column({
    type: 'enum',
    enum: StartedGameStatus,
    default: StartedGameStatus.InProgress,
  })
  status: StartedGameStatus; // e.g., 'in-progress', 'completed'

  @Column()
  roundsOf: number; // Total number of rounds in the tournament

  @OneToMany(() => Match, (match) => match.startedGame, { cascade: true })
  matches: Match[];

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
