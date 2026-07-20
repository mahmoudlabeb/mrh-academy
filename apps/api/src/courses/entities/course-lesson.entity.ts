import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Course } from './course.entity.js';

@Entity('course_lessons')
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  courseId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  videoAssetId: string;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ type: 'int' })
  lessonOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;
}
