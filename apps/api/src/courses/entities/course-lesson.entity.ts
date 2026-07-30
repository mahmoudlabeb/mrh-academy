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
import { CourseSection } from './course-section.entity.js';

type CourseDownloadableFile = {
  id: string;
  name: string;
  url: string;
  publicId: string;
  size: number;
  mimeType: string;
};

type CourseExternalLink = {
  title: string;
  url: string;
};

@Entity('course_lessons')
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  courseId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sectionId: string | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  videoAssetId: string | null;

  @Column({ type: 'text', nullable: true })
  videoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, default: 'video' })
  contentType: 'video' | 'article' | 'resource';

  @Column({ type: 'text', nullable: true })
  articleContent: string | null;

  @Column({ type: 'text', nullable: true })
  resourceUrl: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  downloadableFiles: CourseDownloadableFile[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  externalLinks: CourseExternalLink[];

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

  @ManyToOne(() => CourseSection, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  section: CourseSection | null;
}
