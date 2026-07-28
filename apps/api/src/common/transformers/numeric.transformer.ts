import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(data: number | null): number | null {
    return data;
  }

  from(data: string | null): number | null {
    if (data === null) {
      return null;
    }
    return parseFloat(data);
  }
}
