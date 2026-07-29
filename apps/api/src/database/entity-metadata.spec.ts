import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../common/database/snake-naming.strategy.js';

describe('entity metadata', () => {
  it('uses PostgreSQL-supported types for every entity column', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      database: 'metadata_validation',
      entities: [join(__dirname, '..', '**', '*.entity.ts')],
      namingStrategy: new SnakeNamingStrategy(),
    });

    await (
      dataSource as unknown as {
        buildMetadatas(): Promise<void>;
      }
    ).buildMetadatas();

    expect(
      dataSource.entityMetadatas.map((metadata) => metadata.tableName),
    ).not.toContain('student_favorites');
  });
});
