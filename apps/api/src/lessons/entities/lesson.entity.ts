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
import { LessonStatus } from '@mrh/types';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('lessons')
@Check('CHK_lessons_duration_minutes', '"durationMinutes" IN (25, 50)')
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
  platformFee: number;

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.PENDING })
  status: LessonStatus;

  @Column({ nullable: true })
  roomId: string;

  @Column({ nullable: true })
  meetUrl: string;

  @Column({ nullable: true })
  googleMeetUrl: string;

  @Column({ nullable: true })
  calendarEventId: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutorId' })
  tutor: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'studentId' })
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
