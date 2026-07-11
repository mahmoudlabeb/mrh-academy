import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { Report } from '../entities/report.entity.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async create(userId: string, dto: CreateReportDto) {
    const report = this.reportRepository.create({
      userId,
      lessonId: dto.lessonId ?? null,
      issueType: dto.issueType,
      description: dto.description ?? null,
    } as unknown as DeepPartial<Report>);

    return this.reportRepository.save(report);
  }

  async findAll(limit: number = 50, offset: number = 0) {
    const [data, total] = await this.reportRepository.findAndCount({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }
}
