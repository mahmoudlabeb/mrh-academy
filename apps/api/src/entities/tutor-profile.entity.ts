import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { CourseStatus } from '@mrh/types';
import { ColumnNumericTransformer } from '../common/transformers/numeric.transformer.js';
import { User } from './user.entity.js';

@Entity('tutor_profiles')
export class TutorProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column()
  bio: string;

  @Column()
  specialization: string;

  @Column('text', { array: true })
  languages: string[];

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  hourlyRate: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  balance: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalHoursTaught: number;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.PENDING })
  status: CourseStatus;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ nullable: true })
  documentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.tutorProfile)
  @JoinColumn({ name: 'userId' })
  user: User;
}
