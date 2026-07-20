import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CourseStatus, UserRole } from '@mrh/types';
import { TutorsService } from '../tutors/tutors.service.js';
import { RejectTutorDto } from '../tutors/dto/reject-tutor.dto.js';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';

const ARABIC_FONT_NAME = 'Arabic';

function resolveArabicFontPath(configuredPath?: string) {
  const candidates = [
    configuredPath,
    resolve(process.cwd(), 'dist/assets/fonts/Amiri-Regular.ttf'),
    resolve(process.cwd(), 'public/fonts/Amiri-Regular.ttf'),
    resolve(process.cwd(), 'src/assets/fonts/Amiri-Regular.ttf'),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate));
}

@Controller('admin/tutors')
export class AdminTutorsController {
  constructor(
    private readonly tutorsService: TutorsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async getAllTutors() {
    return this.tutorsService.findAll();
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async getPendingTutors() {
    return this.tutorsService.findAllPending();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async getTutor(@Param('id') id: string) {
    return this.tutorsService.findOneByUserId(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async updateTutor(
    @Param('id') id: string,
    @Body()
    body: {
      bio?: string;
      specialization?: string;
      languages?: string[];
      hourlyRate?: number;
      status?: CourseStatus;
    },
  ) {
    return this.tutorsService.updateTutorProfile(id, body);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async approveTutor(@Param('id') id: string) {
    return this.tutorsService.approveTutor(id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async rejectTutor(@Param('id') id: string, @Body() dto: RejectTutorDto) {
    return this.tutorsService.rejectTutor(id, dto.reason);
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUBADMIN)
  @RequirePermissions('manage_tutors')
  async exportTutorPdf(@Param('id') id: string, @Res() res: Response) {
    const tutorProfile = await this.tutorsService.findOneByUserId(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tutor-${id}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 50 });
    const arabicFontPath = resolveArabicFontPath(
      this.config.get<string>('ARABIC_PDF_FONT_PATH'),
    );
    if (arabicFontPath) {
      doc.registerFont(ARABIC_FONT_NAME, arabicFontPath);
      doc.font(ARABIC_FONT_NAME);
    }
    doc.pipe(res);

    doc.fontSize(20).text('MRH Academy Tutor Application', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('User Details:');
    doc.fontSize(12);
    doc.text(
      `Name: ${tutorProfile.user.firstName} ${tutorProfile.user.lastName}`,
    );
    doc.text(`Email: ${tutorProfile.user.email}`);
    doc.text(`Phone: ${tutorProfile.user.phone || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Tutor Profile:');
    doc.fontSize(12);
    doc.text(`Status: ${tutorProfile.status}`);
    doc.text(`Specialization: ${tutorProfile.specialization}`);
    doc.text(`Languages: ${tutorProfile.languages.join(', ')}`);
    doc.text(`Hourly Rate: $${tutorProfile.hourlyRate.toFixed(2)}`);
    doc.text(`Bio: ${tutorProfile.bio}`);
    doc.moveDown();

    if (tutorProfile.rejectionReason) {
      doc.fontSize(14).text('Rejection Reason:');
      doc.fontSize(12).text(tutorProfile.rejectionReason);
      doc.moveDown();
    }

    doc.end();
  }
}
