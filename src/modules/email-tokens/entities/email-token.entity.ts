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

export enum EmailTokenPurpose {
  CONFIRMATION = 'CONFIRMATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

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

  @Column({
    type: 'enum',
    enum: EmailTokenPurpose,
    default: EmailTokenPurpose.CONFIRMATION,
  })
  @Index()
  purpose: EmailTokenPurpose;

  @CreateDateColumn()
  createdAt: Date; // Automatically sets timestamp when created
}
