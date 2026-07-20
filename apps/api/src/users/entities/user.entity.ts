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
import type { NotificationPreferences } from '../../common/types/notification-preferences.js';
import type { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';
import type { StudentProfile } from '../../students/entities/student-profile.entity.js';
import type { SubAdminProfile } from '../../admin/entities/sub-admin-profile.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'text', select: false, nullable: true })
  passwordHash: string | null;

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

  @Column({ nullable: true, type: 'varchar' })
  inviteToken: string;

  @Column({ nullable: true, type: 'timestamp' })
  inviteTokenExpires: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToOne('TutorProfile', (profile: any) => profile.user)
  tutorProfile: TutorProfile;

  @OneToOne('StudentProfile', (profile: any) => profile.user)
  studentProfile: StudentProfile;

  @OneToOne('SubAdminProfile', (profile: any) => profile.user)
  subAdminProfile: SubAdminProfile;
}
