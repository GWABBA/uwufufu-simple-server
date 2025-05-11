import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Selection } from '../../selections/entities/selection.entity';
import { StartedGame } from './started-game.entity';

@Entity('matches')
@Index('idx_matches_startedGameId_roundsOf', ['startedGameId', 'roundsOf'])
@Index('idx_matches_startedGameId_createdAt', ['startedGameId', 'createdAt'])
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => StartedGame, { onDelete: 'CASCADE' })
  startedGame: StartedGame;

  @Column()
  @Index()
  startedGameId: number;

  @Column()
  roundsOf: number;

  @ManyToOne(() => Selection, { onDelete: 'CASCADE' })
  selection1: Selection;

  @Column()
  selection1Id: number;

  @ManyToOne(() => Selection, { onDelete: 'CASCADE' })
  selection2: Selection;

  @Column()
  selection2Id: number;

  @Column({ nullable: true })
  @Index()
  winnerId: number; // ID of the winner (null until determined)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
