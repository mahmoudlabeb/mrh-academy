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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutorId' })
  tutor: User;
}
