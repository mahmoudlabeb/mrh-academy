import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';

@Entity('course_refund_reversals')
export class CourseRefundReversal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  paymentId: string;

  @Index()
  @Column()
  originalEnrollmentId: string;

  @Column()
  studentId: string;

  @Column()
  courseId: string;

  @Column()
  tutorId: string;

  @Column({ type: 'varchar', length: 10 })
  soldBy: 'tutor' | 'academy';

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  paidAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  platformFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  tutorShare: number;

  @Column({ type: 'varchar', nullable: true })
  stripeChargeId: string | null;

  @CreateDateColumn()
  reversedAt: Date;
}
