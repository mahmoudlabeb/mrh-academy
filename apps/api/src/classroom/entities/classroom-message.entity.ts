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
import { Lesson } from '../../lessons/entities/lesson.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('classroom_messages')
export class ClassroomMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  lessonId: string;

  @Index()
  @Column()
  senderId: string;

  @Column()
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;
}
