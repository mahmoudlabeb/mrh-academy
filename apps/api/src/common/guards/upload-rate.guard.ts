import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class UploadRateGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly maxUploads = 10;
  private readonly windowMs = 60000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.ip ?? 'anonymous';

    const now = Date.now();
    const entry = this.store.get(userId);

    if (!entry || now > entry.resetAt) {
      this.store.set(userId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxUploads) {
      throw new HttpException(
        `Upload limit exceeded. Max ${this.maxUploads} uploads per minute.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
