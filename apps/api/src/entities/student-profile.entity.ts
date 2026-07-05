import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../common/transformers/numeric.transformer.js';
import { User } from './user.entity.js';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryColumn()
  userId: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  balance: number;

  @Column({ nullable: true })
  preferredLanguage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.studentProfile)
  @JoinColumn({ name: 'userId' })
  user: User;
}
