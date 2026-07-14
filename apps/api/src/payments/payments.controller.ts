import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UploadRateGuard } from '../common/guards/upload-rate.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';
import { InvoiceService } from './invoice.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard, RolesGuard, UploadRateGuard)
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileInterceptor('screenshot', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ];
        if (!allowed.includes(file.mimetype)) {
          callback(
            new BadRequestException('Receipt must be JPEG, PNG, WebP, or PDF'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async submitPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.paymentsService.submitPayment(user.id, dto, file);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async getPaymentHistory(@CurrentUser() user: { id: string }) {
    return this.paymentsService.getPaymentHistory(user.id);
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
      method: payment.method,
      status: payment.status,
      createdAt: payment.createdAt,
      adminNote: payment.adminNote,
    });
    res.end(pdf);
  }
}
