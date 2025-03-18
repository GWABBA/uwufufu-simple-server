import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Selection } from '../../selections/entities/selection.entity';
import { Visibility } from '../../../core/enums/visibility.enum';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Locales } from 'src/core/enums/locales.enum';

@Entity('games')
// ✅ Filters & Soft Deletes
@Index('idx_games_visibility_deletedAt', ['visibility', 'deletedAt'])
@Index('idx_games_deletedAt', ['deletedAt'])
// ✅ Sorting
@Index('idx_games_createdAt', ['createdAt']) // Sorting by latest
@Index('idx_games_createdAt_deletedAt', ['createdAt', 'deletedAt']) // Sorting while filtering deletedAt
@Index('idx_games_plays', ['plays']) // Sorting by popularity
// ✅ Filtering
@Index('idx_games_locale', ['locale']) // Locale filtering
@Index('idx_games_isNsfw', ['isNsfw']) // NSFW filtering
@Index('idx_games_categoryId', ['category']) // Category filtering
@Index('idx_games_userId', ['user']) // User-based filtering
// ✅ Pagination Optimization
@Index('idx_games_createdAt_id', ['createdAt', 'id']) // Optimized OFFSET pagination
@Index('idx_games_visibility_createdAt', ['visibility', 'createdAt']) // Visibility + CreatedAt for filtering & sorting
@Index('idx_games_categoryId_createdAt', ['category', 'createdAt']) // Category + CreatedAt for filtering & sorting
@Index('idx_games_locale_createdAt', ['locale', 'createdAt']) // Locale + CreatedAt for filtering & sorting
@Index('idx_games_isNsfw_createdAt', ['isNsfw', 'createdAt']) // NSFW + CreatedAt for filtering & sorting
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  slug: string;

  @Column({ nullable: true })
  mongoId: string;

  @ManyToOne(() => User, (user) => user.games, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Selection, (selection) => selection.game)
  selections: Selection[];

  @ManyToOne(() => Category, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: true })
  coverImage: string;

  @Column({ default: 0 })
  plays: number;

  @Column({
    type: 'enum',
    enum: Visibility,
    default: Visibility.IsPublic,
  })
  visibility: Visibility;

  @Column({
    type: 'enum',
    enum: Locales,
    nullable: true,
  })
  locale: Locales;

  @Column({ default: false })
  isNsfw: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp' }) // Tracks soft delete timestamp
  deletedAt?: Date;

  startedGames: any;
}
