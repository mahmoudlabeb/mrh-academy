import { ColumnNumericTransformer } from './numeric.transformer';

describe('ColumnNumericTransformer', () => {
  const transformer = new ColumnNumericTransformer();

  it('preserves nullable database values', () => {
    expect(transformer.from(null)).toBeNull();
    expect(transformer.to(null)).toBeNull();
  });

  it('converts PostgreSQL numeric strings to numbers', () => {
    expect(transformer.from('41.67')).toBe(41.67);
    expect(transformer.to(41.67)).toBe(41.67);
  });
});
