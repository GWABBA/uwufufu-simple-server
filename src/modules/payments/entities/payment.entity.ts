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

@Index('ix_payments_subscriptionId_notnull', ['subscriptionId'], {
  where: '"subscriptionId" IS NOT NULL',
})
@Index('ix_payments_saleId_notnull', ['saleId'], {
  where: '"saleId" IS NOT NULL',
})
@Index('ix_payments_user_status_createdAt', ['user', 'status', 'createdAt'])
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ✅ keep temporarily if you still backfill from it; drop later
  @Column({ nullable: true })
  paypalOrderId?: string;

  // ✅ split IDs
  @Column({ nullable: true })
  subscriptionId?: string; // e.g., I-XXXX...

  @Column({ nullable: true })
  saleId?: string; // e.g., PAYID-..., 9VY...

  @Column({ nullable: false })
  status: string;

  @Column({ nullable: true })
  payerEmail?: string;

  // ✅ money should be numeric in DB
  @Column({ type: 'numeric', nullable: true })
  amount?: number;

  @Column({ nullable: true })
  currency?: string;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' }) // creates userId FK column
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
