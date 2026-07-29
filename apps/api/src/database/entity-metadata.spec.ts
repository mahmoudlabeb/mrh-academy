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

    await expect(
      (
        dataSource as unknown as {
          buildMetadatas(): Promise<void>;
        }
      ).buildMetadatas(),
    ).resolves.toBeUndefined();
  });
});
