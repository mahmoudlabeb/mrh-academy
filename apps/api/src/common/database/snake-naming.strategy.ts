import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/** Stable PostgreSQL identifiers for all TypeORM-generated names. */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName: string): string {
    return customName ? snakeCase(customName) : snakeCase(className);
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return snakeCase(
      embeddedPrefixes.concat(customName || propertyName).join('_'),
    );
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return snakeCase(`${firstTableName}_${firstPropertyName}_${secondTableName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    _columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${propertyName}`);
  }
}
