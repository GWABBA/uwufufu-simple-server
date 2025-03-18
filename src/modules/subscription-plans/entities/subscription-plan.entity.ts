import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'interval', default: '1 month' })
  billingCycle: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null; // Soft delete column
}
