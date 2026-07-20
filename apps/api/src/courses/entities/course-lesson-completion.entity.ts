import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CourseEnrollment } from './course-enrollment.entity.js';
import { CourseLesson } from './course-lesson.entity.js';

@Entity('course_lesson_completions')
@Unique(['enrollmentId', 'courseLessonId'])
export class CourseLessonCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  enrollmentId: string;

  @Index()
  @Column()
  courseLessonId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => CourseEnrollment)
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: CourseEnrollment;

  @ManyToOne(() => CourseLesson)
  @JoinColumn({ name: 'course_lesson_id' })
  courseLesson: CourseLesson;
}
