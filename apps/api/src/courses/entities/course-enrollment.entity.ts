import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import { User } from '../../users/entities/user.entity.js';
import { Course } from './course.entity.js';

@Entity('course_enrollments')
@Unique(['studentId', 'courseId'])
export class CourseEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  studentId: string;

  @Index()
  @Column()
  courseId: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  platformFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  tutorShare: number;

  @Column({ type: 'varchar', length: 10, default: 'academy' })
  soldBy: 'tutor' | 'academy';

  @Column({ type: 'varchar', nullable: true })
  referralTutorId: string | null;

  @Column({ type: 'int', default: 0 })
  progressPercentage: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  enrolledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'studentId' })
  student: User;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId' })
  course: Course;
}
