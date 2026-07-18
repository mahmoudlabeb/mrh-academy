import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';

/**
 * Manual (non-Stripe) Payout System
 * ─────────────────────────────────
 * Allows tutors to request manual payouts (bank transfer, Instapay, etc.).
 * Flow: Tutor requests → Admin approves/rejects → Balance adjusted manually.
 *
 * For Stripe Connect automated payouts, see:
 *   AdminPaymentsController.payoutTutor()  — admin triggers Stripe transfer
 *   StripeConnectController                — handles Stripe onboarding
 */
@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.TUTOR)
  requestPayout(
    @CurrentUser() user: { id: string },
    @Body() dto: RequestPayoutDto,
  ) {
    return this.paymentsService.requestPayout(user.id, dto);
  }

  @Get('my')
  @Roles(UserRole.TUTOR)
  getMyPayouts(@CurrentUser() user: { id: string }) {
    return this.paymentsService.getTutorPayouts(user.id);
  }

  /** Admin: list all payout requests */
  @Get()
  @Roles(UserRole.ADMIN)
  async getAllPayouts() {
    return this.paymentsService.getAllPayouts();
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  approvePayout(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.paymentsService.approvePayout(id, admin.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  rejectPayout(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.paymentsService.rejectPayout(id, admin.id, reason);
  }
}
