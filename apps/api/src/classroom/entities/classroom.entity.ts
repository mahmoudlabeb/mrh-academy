import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity.js';

@Entity('classrooms')
export class Classroom {
  @PrimaryColumn('uuid')
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
