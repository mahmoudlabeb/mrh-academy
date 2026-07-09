import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
} from 'typeorm';
import { UserRole } from '@mrh/types';
import type { NotificationPreferences } from '../common/types/notification-preferences.js';
import { TutorProfile } from './tutor-profile.entity.js';
import { StudentProfile } from './student-profile.entity.js';
import { SubAdminProfile } from './sub-admin-profile.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'Africa/Cairo' })
  timezone: string;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  notificationPreferences: NotificationPreferences;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToOne(() => TutorProfile, (profile) => profile.user)
  tutorProfile: TutorProfile;

  @OneToOne(() => StudentProfile, (profile) => profile.user)
  studentProfile: StudentProfile;

  @OneToOne(() => SubAdminProfile, (profile) => profile.user)
  subAdminProfile: SubAdminProfile;
}
