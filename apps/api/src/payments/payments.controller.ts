import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async submitPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.paymentsService.submitPayment(user.id, dto, file);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@CurrentUser() user: { id: string }) {
    return this.paymentsService.getPaymentHistory(user.id);
  }
}
