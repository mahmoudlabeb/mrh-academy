import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';
import { PayoutStatus } from '@mrh/types';

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tutorId: string;

  @ManyToOne(() => TutorProfile)
  @JoinColumn({ name: 'tutor_id', referencedColumnName: 'userId' })
  tutor: TutorProfile;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string | null;

  @Column({ type: 'text', nullable: true })
  accountDetails: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  @Column({ nullable: true })
  stripePayoutId?: string;

  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  paypalBatchId: string | null;

  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  paypalItemId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  providerStatus: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  balanceRestoredAt: Date | null;

  @Column({ nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
