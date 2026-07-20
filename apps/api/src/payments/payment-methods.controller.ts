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
    if (configs.length === 0) {
      // Fallback uses PaymentMethod enum values — must match exactly
      return [
        { type: 'card', label: 'Credit Card', enabled: true, details: null },
        { type: 'paypal', label: 'PayPal', enabled: true, details: null },
        {
          type: 'vodafone',
          label: 'Vodafone Cash',
          enabled: true,
          details: '01000000000',
        },
        {
          type: 'instapay',
          label: 'Instapay',
          enabled: true,
          details: '@mrh_academy',
        },
        {
          type: 'binance',
          label: 'Binance',
          enabled: true,
          details: 'Configure in admin settings',
        },
        {
          type: 'bank',
          label: 'Bank Transfer',
          enabled: true,
          details: 'Configure in admin settings',
        },
      ];
    }
    return configs.map((c) => ({
      type: c.type,
      label: c.label,
      enabled: c.enabled,
      details: c.details,
    }));
  }
}
