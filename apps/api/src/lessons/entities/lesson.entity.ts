import {
  Entity,
  Check,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  AfterLoad,
} from 'typeorm';
import { LessonPaymentStatus, LessonStatus } from '@mrh/types';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('lessons')
@Check(
  'chk_lessons_duration_minutes',
  '"duration_minutes" IN (25, 50) OR ("duration_minutes" BETWEEN 60 AND 480 AND MOD("duration_minutes", 60) = 0)',
)
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tutorId: string;

  @Index()
  @Column()
  studentId: string;

  @Column({ type: 'timestamp' })
  scheduledTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  platformFee: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  tutorShare: number | null;

  @Column({ type: 'timestamp', nullable: true })
  tutorShareReleasedAt: Date | null;

  @Index('IDX_lessons_idempotency_key', { unique: true })
  @Column({ type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.CONFIRMED })
  status: LessonStatus;

  @Column({
    type: 'enum',
    enum: LessonPaymentStatus,
    default: LessonPaymentStatus.PAID,
  })
  paymentStatus: LessonPaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  roomId: string | null;

  @Column({ type: 'varchar', nullable: true })
  meetUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleMeetUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  calendarEventId: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @AfterLoad()
  syncRoomId() {
    if (this.roomId && !this.meetUrl) {
      this.meetUrl = this.roomId;
    } else if (!this.roomId && this.meetUrl) {
      this.roomId = this.meetUrl;
    }
  }
}
