import { BadRequestException } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

const COMPROMISED_PASSWORDS = new Set([
  'password',
  'password123456789',
  '123456789012345',
  'qwertyuiop12345',
]);

export function assertPasswordAllowed(password: string) {
  if (password.length < 15 || password.length > 128) {
    throw new BadRequestException(
      'Password must be between 15 and 128 characters',
    );
  }
  if (COMPROMISED_PASSWORDS.has(password.toLowerCase())) {
    throw new BadRequestException(
      'Choose a password that is not commonly used',
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordAllowed(password);
  return hash(password, { type: argon2id });
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
