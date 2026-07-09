import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Lesson } from './lesson.entity.js';

@Entity('lesson_books')
export class LessonBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  lessonId: string;

  @Column()
  uploadedBy: string;

  @Column({ length: 255 })
  title: string;

  @Column()
  cloudinaryPublicId: string;

  @Column({ type: 'int', default: 1 })
  pageCount: number;

  @Column({ type: 'varchar', length: 64, default: 'application/pdf' })
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
