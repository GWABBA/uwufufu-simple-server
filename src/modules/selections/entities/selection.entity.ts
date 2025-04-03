import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';
import { Game } from '../../games/entities/game.entity';

@Entity('selections')
@Index(['gameId', 'deletedAt'])
export class Selection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, (game) => game.selections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' }) // Specify the foreign key column
  @Index()
  game: Game;

  @Column()
  @Index() // Or add the index inline
  gameId: number;

  @Column({ nullable: true })
  mongoId: string;

  @Column({ nullable: true })
  @Index()
  name: string;

  @Column({ default: false })
  isVideo: boolean;

  @Column({ nullable: true })
  videoSource: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ type: 'double precision', default: 0 })
  startTime: number;

  @Column({ type: 'double precision', default: 0 })
  endTime: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  losses: number;

  @Column({ default: 0 })
  @Index()
  finalWins: number;

  @Column({ default: 0 })
  finalLosses: number;

  @Column({ nullable: true })
  resourceUrl: string;

  @Column({
    type: 'double precision',
    generatedType: 'STORED',
    asExpression: `
      CASE 
        WHEN ("finalWins" + "finalLosses") = 0 THEN 0 
        ELSE "finalWins"::double precision / ("finalLosses" + "finalWins")::double precision 
      END
    `,
  })
  @Index()
  finalWinLossRatio: number;

  @Column({
    type: 'double precision',
    generatedType: 'STORED',
    asExpression: `
      CASE 
        WHEN ("wins" + "losses") = 0 THEN 0 
        ELSE "wins"::double precision / ("losses" + "wins")::double precision 
      END
    `,
  })
  @Index()
  winLossRatio: number;

  @CreateDateColumn({ type: 'timestamp' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  @Index()
  deletedAt: Date | null;
}
