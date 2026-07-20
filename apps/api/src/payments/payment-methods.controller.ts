import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodConfig } from './entities/payment-method-config.entity.js';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    @InjectRepository(PaymentMethodConfig)
    private readonly configRepository: Repository<PaymentMethodConfig>,
  ) {}

  @Get()
  async getActiveMethods() {
    const configs = await this.configRepository.find({
      where: { enabled: true },
      order: { sortOrder: 'ASC' },
    });
    return configs.map((c) => ({
      type: c.type,
      label: c.label,
      enabled: c.enabled,
      details: c.details,
    }));
  }
}
