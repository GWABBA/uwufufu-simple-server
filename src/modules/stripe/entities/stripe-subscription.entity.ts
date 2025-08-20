import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StripeCustomer } from './stripe-customer.entity';

export type StripeSubStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

@Entity({ name: 'stripe_subscriptions' })
export class StripeSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  stripeSubscriptionId!: string; // sub_...

  @ManyToOne(() => StripeCustomer, (c) => c.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stripeCustomerId' })
  customer!: StripeCustomer;

  @Index()
  @Column({ type: 'uuid' })
  stripeCustomerId!: string; // fk -> StripeCustomer.id

  @Index()
  @Column({ type: 'varchar', nullable: true })
  priceId!: string | null; // price_...

  @Column({ type: 'varchar' })
  status!: StripeSubStatus;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
