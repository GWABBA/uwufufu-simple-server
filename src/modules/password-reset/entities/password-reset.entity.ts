import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  token: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  @Column({ type: 'timestamp', nullable: false })
  expiresAt: Date;
}
