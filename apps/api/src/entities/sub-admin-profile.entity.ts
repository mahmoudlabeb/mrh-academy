import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('sub_admin_profiles')
export class SubAdminProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column('text', { array: true })
  assignedPermissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.subAdminProfile)
  @JoinColumn({ name: 'userId' })
  user: User;
}
