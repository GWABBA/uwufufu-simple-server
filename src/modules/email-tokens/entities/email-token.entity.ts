import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('email_tokens')
export class EmailToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) // Automatically delete when user is deleted
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  @Index()
  token: string;

  @CreateDateColumn()
  createdAt: Date; // Automatically sets timestamp when created
}
