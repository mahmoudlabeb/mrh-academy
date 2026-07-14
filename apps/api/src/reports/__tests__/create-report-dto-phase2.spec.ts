import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateReportDto } from '../dto/create-report.dto.js';

describe('CreateReportDto phase 2 regression', () => {
  it('accepts issueType as the report category field', async () => {
    const dto = plainToInstance(CreateReportDto, {
      lessonId: '550e8400-e29b-41d4-a716-446655440000',
      issueType: 'Audio problem',
      description: 'The microphone was cutting out.',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects subject because the API contract requires issueType', async () => {
    const dto = plainToInstance(CreateReportDto, {
      lessonId: '550e8400-e29b-41d4-a716-446655440000',
      subject: 'Audio problem',
      description: 'The microphone was cutting out.',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'issueType')).toBe(true);
  });
});
