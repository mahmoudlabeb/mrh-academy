import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from './entities/student-profile.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { PaymentMethodConfig } from '../payments/entities/payment-method-config.entity.js';
import { Setting } from '../admin/entities/setting.entity.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { UsersModule } from '../users/users.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [
    PaymentsModule,
    TypeOrmModule.forFeature([
      StudentProfile,
      Payment,
      Lesson,
      PaymentMethodConfig,
      Setting,
    ]),
    UsersModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
