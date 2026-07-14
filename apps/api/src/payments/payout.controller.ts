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

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  approvePayout(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.paymentsService.approvePayout(id, admin.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  rejectPayout(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.paymentsService.rejectPayout(id, admin.id, reason);
  }
}
