import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class UploadRateGuard implements CanActivate {
  private readonly maxUploads = 10;
  private readonly windowSeconds = 60;

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.ip ?? 'anonymous';
    const allowed = await this.redisService.consumeRateLimit(
      `rate:upload:${userId}`,
      this.maxUploads,
      this.windowSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        `Upload limit exceeded. Max ${this.maxUploads} uploads per minute.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
