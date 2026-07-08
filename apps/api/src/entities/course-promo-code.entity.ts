import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TutorProfile } from './tutor-profile.entity.js';
import { Course } from './course.entity.js';

@Entity('course_promo_codes')
export class CoursePromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tutorId: string;

  @ManyToOne(() => TutorProfile)
  @JoinColumn({ name: 'tutorId' })
  tutor: TutorProfile;

  @Index()
  @Column()
  courseId: string;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column({ unique: true })
  code: string;

  @Column({ default: 100 })
  usageLimit: number;

  @Column({ default: 0 })
  currentUses: number;

  @CreateDateColumn()
  createdAt: Date;
}
