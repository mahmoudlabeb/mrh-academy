import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('vocabulary_words')
export class VocabularyWord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column()
  word: string;

  @Column({ type: 'text' })
  definition: string;

  @Column({ type: 'text', nullable: true })
  examples: string;

  @Column({ type: 'text', nullable: true })
  translation: string;

  @Column({ type: 'varchar', default: 'en' })
  language: string;

  @Column({ type: 'text', nullable: true })
  contextSentence: string;

  @CreateDateColumn()
  savedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
