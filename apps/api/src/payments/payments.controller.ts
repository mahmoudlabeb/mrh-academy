import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';
import { InvoiceService } from './invoice.service.js';
import { CreateCourseCheckoutDto } from './dto/create-course-checkout.dto.js';
import { Throttle } from '@nestjs/throttler';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('course-checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async createCourseCheckout(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCourseCheckoutDto,
  ) {
    return this.paymentsService.createCourseCheckout(user.id, dto);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async submitPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.paymentsService.submitPayment(user.id, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async getPaymentHistory(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getPaymentHistory(
      user.id,
      Math.max(1, Math.floor(Number(page) || 1)),
      Math.min(100, Math.max(1, Math.floor(Number(limit) || 50))),
    );
  }

  @Post('paypal/:id/capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async capturePayPalPayment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.capturePayPalPayment(id, user.id);
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="invoice.pdf"')
  async downloadInvoice(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const payment = await this.paymentsService.getPayment(id);
    if (payment.userId !== user.id) {
      throw new BadRequestException('Payment does not belong to you');
    }
    const pdf = await this.invoiceService.generateInvoicePdf({
      invoiceId: payment.id,
      studentName: payment.user?.firstName
        ? `${payment.user.firstName} ${payment.user.lastName || ''}`
        : user.id,
      tutorName: 'Tutor',
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      createdAt: payment.createdAt,
      adminNote: payment.adminNote,
    });
    res.end(pdf);
  }
}
