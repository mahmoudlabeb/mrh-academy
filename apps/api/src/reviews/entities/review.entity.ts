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
import { CourseStatus } from '@mrh/types';
import { User } from '../../users/entities/user.entity.js';
import { Lesson } from '../../lessons/entities/lesson.entity.js';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  studentId: string;

  @Index()
  @Column()
  tutorId: string;

  @Index()
  @Column({ unique: true })
  lessonId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.PENDING })
  status: CourseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'studentId' })
  student: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutorId' })
  tutor: User;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
