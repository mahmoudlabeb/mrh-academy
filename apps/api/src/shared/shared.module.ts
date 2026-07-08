import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../entities/setting.entity.js';
import { CommissionService } from '../services/commission.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class SharedModule {}
