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
import { ColumnNumericTransformer } from '../../common/transformers/numeric.transformer.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  tutorId: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'varchar', length: 20, default: 'recorded' })
  courseType: 'recorded' | 'live';

  @Column({ type: 'varchar', length: 240, nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  previewVideoUrl: string | null;

  @Column({ type: 'simple-array', nullable: true })
  learningOutcomes: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  requirements: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  targetAudience: string[] | null;

  @Column({ type: 'varchar', length: 80, default: 'Arabic' })
  language: string;

  @Column({ type: 'varchar', length: 30, default: 'beginner' })
  level: string;

  @Column({ type: 'varchar', length: 80, default: 'Africa/Cairo' })
  timezone: string;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'timestamp', nullable: true })
  cohortStartAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cohortEndAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isDraft: boolean;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price: number;

  @Column({ nullable: true })
  bunnyVideoId: string;

  @Column({ type: 'varchar', default: 'academy' })
  soldBy: string;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.PENDING })
  status: CourseStatus;

  @Column({ type: 'timestamp', nullable: true })
  videoQualityApprovedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  videoQualityApprovedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;
}
