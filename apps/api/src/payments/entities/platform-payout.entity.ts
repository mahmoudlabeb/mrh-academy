import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayoutStatus } from '@mrh/types';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('platform_payouts')
export class PlatformPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  requestedBy: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'varchar' })
  receiverEmail: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  idempotencyKey: string;

  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  paypalBatchId: string | null;

  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  paypalItemId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  providerStatus: string | null;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
