// src/modules/stripe/entities/stripe-customer.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StripeSubscription } from './stripe-subscription.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'stripe_customers' })
export class StripeCustomer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // FK → users.id (nullable)
  @Index()
  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @ManyToOne(() => User, (u) => u.stripeCustomers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  stripeCustomerId!: string; // cus_...

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @OneToMany(() => StripeSubscription, (s) => s.customer)
  subscriptions!: StripeSubscription[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
