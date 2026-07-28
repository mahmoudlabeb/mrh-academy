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

  @Column({ type: 'text', nullable: true })
  videoAssetId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, default: 'video' })
  contentType: 'video' | 'article' | 'resource';

  @Column({ type: 'text', nullable: true })
  articleContent: string | null;

  @Column({ type: 'text', nullable: true })
  resourceUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isPreview: boolean;

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
