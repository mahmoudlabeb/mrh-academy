import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { PaymentsService } from '../payments.service.js';
import { PayPalService } from './paypal.service.js';

export interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
}

@Controller('webhooks/paypal')
export class PayPalWebhookController {
  constructor(
    private readonly payPalService: PayPalService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Public()
  @Post()
  async handle(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() event: PayPalWebhookEvent,
  ) {
    if (!event?.id || !event.event_type || !event.resource) {
      throw new BadRequestException('Malformed PayPal webhook');
    }
    const verified = await this.payPalService.verifyWebhookSignature(
      headers,
      event,
    );
    if (!verified) {
      throw new BadRequestException('Invalid PayPal webhook signature');
    }
    return this.paymentsService.processPayPalWebhookEvent(event);
  }
}
