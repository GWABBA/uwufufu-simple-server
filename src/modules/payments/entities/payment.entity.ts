import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  paypalOrderId: string;

  @Column({ nullable: false })
  status: string;

  @Column({ nullable: true })
  payerEmail?: string;

  @Column({ nullable: true })
  amount?: number;

  @Column({ nullable: true })
  currency?: string;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' }) // Creates `userId` as a foreign key in `payments` table
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
