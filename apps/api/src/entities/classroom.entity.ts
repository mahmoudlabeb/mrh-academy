import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Lesson } from './lesson.entity.js';

@Entity('classrooms')
export class Classroom {
  @PrimaryColumn()
  lessonId: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  startedAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  endedAt: Date;

  @Column({ nullable: true, type: 'jsonb' })
  whiteboardSnapshot: object;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
