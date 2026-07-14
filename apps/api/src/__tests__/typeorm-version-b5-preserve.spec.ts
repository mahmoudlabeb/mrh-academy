import { Entity, PrimaryGeneratedColumn, Column, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('B5 Preservation — TypeORM Functionality', () => {
  it('should export @Entity decorator from typeorm', () => {
    expect(Entity).toBeDefined();
    expect(typeof Entity).toBe('function');
  });

  it('should export @PrimaryGeneratedColumn decorator', () => {
    expect(PrimaryGeneratedColumn).toBeDefined();
    expect(typeof PrimaryGeneratedColumn).toBe('function');
  });

  it('should export @Column decorator', () => {
    expect(Column).toBeDefined();
    expect(typeof Column).toBe('function');
  });

  it('should export getRepositoryToken from @nestjs/typeorm', () => {
    expect(getRepositoryToken).toBeDefined();
    expect(typeof getRepositoryToken).toBe('function');
  });

  it('should export DataSource class from typeorm', () => {
    expect(DataSource).toBeDefined();
    expect(typeof DataSource).toBe('function');
  });
});
