import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from './payments.service.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';

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

  @Get('options')
  @Roles(UserRole.TUTOR)
  getPayoutOptions() {
    return this.paymentsService.getTutorPayoutOptions();
  }

  @Get('my')
  @Roles(UserRole.TUTOR)
  getMyPayouts(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getTutorPayouts(
      user.id,
      Math.max(1, Math.floor(Number(page) || 1)),
      Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))),
    );
  }

  @Get('my/transactions')
  @Roles(UserRole.TUTOR)
  getMyTransactions(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getTutorTransactions(
      user.id,
      Math.max(1, Math.floor(Number(page) || 1)),
      Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))),
    );
  }

  /** Admin: list all payout requests */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_payments')
  async getAllPayouts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getAllPayouts(
      Math.max(1, Math.floor(Number(page) || 1)),
      Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))),
    );
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_payments')
  approvePayout(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.paymentsService.approvePayout(id, admin.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_payments')
  rejectPayout(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.paymentsService.rejectPayout(id, admin.id, reason);
  }
}
