import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('student_favorites')
@Unique(['studentId', 'tutorId'])
export class StudentFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  studentId: string;

  @Index()
  @Column()
  tutorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;
}
