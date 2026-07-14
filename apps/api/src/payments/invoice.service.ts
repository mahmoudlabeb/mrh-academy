import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import { reshapeForPdf } from '../shared/pdf-arabic.util.js';

const ARABIC_FONT_NAME = 'ArabicFont';

@Injectable()
export class InvoiceService {
  private readonly arabicFontPath: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const fontPath = this.configService.get<string>('ARABIC_PDF_FONT_PATH');
    if (fontPath && fs.existsSync(fontPath)) {
      this.arabicFontPath = fontPath;
    }
  }

  async generateInvoicePdf(invoiceData: {
    invoiceId: string;
    studentName: string;
    tutorName: string;
    amount: number;
    method: string;
    status: string;
    createdAt: Date;
    adminNote?: string | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (this.arabicFontPath) {
        doc.registerFont(ARABIC_FONT_NAME, this.arabicFontPath);
        doc.font(ARABIC_FONT_NAME);
      }

      doc.fontSize(22).text(reshapeForPdf('MRH Academy'), { align: 'center' });
      doc
        .fontSize(16)
        .text(reshapeForPdf('Payment Invoice'), { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12);
      doc.text(`Invoice ID: ${invoiceData.invoiceId}`);
      doc.text(`Date: ${invoiceData.createdAt.toISOString().split('T')[0]}`);
      doc.moveDown();

      doc.text(`Student: ${reshapeForPdf(invoiceData.studentName)}`);
      doc.text(`Tutor: ${reshapeForPdf(invoiceData.tutorName)}`);
      doc.moveDown();

      doc.text(`Amount: $${invoiceData.amount.toFixed(2)}`);
      doc.text(`Payment Method: ${invoiceData.method}`);
      doc.text(`Status: ${invoiceData.status}`);

      if (invoiceData.adminNote) {
        doc.moveDown();
        doc.text(`Note: ${reshapeForPdf(invoiceData.adminNote)}`);
      }

      doc.moveDown(2);
      doc.fontSize(10).text(reshapeForPdf('Thank you for using MRH Academy!'), {
        align: 'center',
      });

      doc.end();
    });
  }
}
