import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PaymentMethodConfig } from '../payments/entities/payment-method-config.entity.js';

@Controller('admin/payment-methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@RequirePermissions('manage_payments')
export class AdminPaymentMethodsController {
  constructor(
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodConfigRepository: Repository<PaymentMethodConfig>,
    private readonly configService: ConfigService,
  ) {}

  private assertCanEnable(type: string, details?: string | null) {
    if (
      ['instapay', 'vodafone_cash', 'binance', 'bank_transfer'].includes(
        type,
      ) &&
      !details?.trim()
    ) {
      throw new BadRequestException(
        'Configure the transfer destination/instructions before enabling this method',
      );
    }
    if (
      type === 'paypal' &&
      (!this.configService.get<string>('PAYPAL_CLIENT_ID')?.trim() ||
        !this.configService.get<string>('PAYPAL_CLIENT_SECRET')?.trim())
    ) {
      throw new BadRequestException(
        'Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET before enabling PayPal',
      );
    }
    if (
      type === 'card' &&
      !this.configService.get<string>('STRIPE_SECRET_KEY')?.trim()
    ) {
      throw new BadRequestException(
        'Configure STRIPE_SECRET_KEY before enabling card payments',
      );
    }
  }

  @Get()
  async getAll() {
    return this.paymentMethodConfigRepository.find({
      order: { sortOrder: 'ASC' },
    });
  }

  @Post()
  async create(
    @Body()
    body: {
      type: string;
      label: string;
      details?: string;
      sortOrder?: number;
      enabled?: boolean;
    },
  ) {
    if (body.enabled) this.assertCanEnable(body.type, body.details);
    const config = this.paymentMethodConfigRepository.create({
      type: body.type,
      label: body.label,
      details: body.details ?? null,
      sortOrder: body.sortOrder ?? 0,
      enabled: body.enabled ?? false,
    });
    return this.paymentMethodConfigRepository.save(config);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      enabled?: boolean;
      details?: string;
      sortOrder?: number;
    },
  ) {
    const config = await this.paymentMethodConfigRepository.findOneByOrFail({
      id,
    });
    if (body.label !== undefined) config.label = body.label;
    if (body.enabled !== undefined) config.enabled = body.enabled;
    if (body.details !== undefined) config.details = body.details;
    if (body.sortOrder !== undefined) config.sortOrder = body.sortOrder;
    if (body.enabled) {
      this.assertCanEnable(config.type, config.details);
    }
    return this.paymentMethodConfigRepository.save(config);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.paymentMethodConfigRepository.delete(id);
    return { success: true };
  }
}
