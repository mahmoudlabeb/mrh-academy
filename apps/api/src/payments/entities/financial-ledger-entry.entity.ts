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
import { FinancialLedgerStatus, FinancialTransactionType } from '@mrh/types';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import { User } from '../../users/entities/user.entity.js';
import { Course } from '../../courses/entities/course.entity.js';
import { Lesson } from '../../lessons/entities/lesson.entity.js';

export type SafeFinancialMetadata = Record<
  string,
  string | number | boolean | null
>;

@Entity('financial_ledger_entries')
export class FinancialLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  eventKey: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  transactionType: FinancialTransactionType;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  status: FinancialLedgerStatus;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 50 })
  method: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  tutorId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  courseId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  lessonId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  payoutId: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  providerReferenceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerStatus: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  adminCommission: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  tutorShare: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  balanceBefore: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  balanceAfter: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: SafeFinancialMetadata;

  @Index()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tutor_id' })
  tutor: User | null;

  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: 'course_id' })
  course: Course | null;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;
}
