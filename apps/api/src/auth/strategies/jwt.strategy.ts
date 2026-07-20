import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { JWT_ALGORITHM, getJwtVerifyOptions } from '../jwt-profile.js';
import { RedisService } from '../../redis/redis.service.js';

interface JwtPayload {
  sub: string;
  jti: string;
  tokenVersion: string;
  sessionId?: string;
  type?: 'access' | 'refresh';
  originalAdminId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.mrh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
      algorithms: [JWT_ALGORITHM],
      issuer: getJwtVerifyOptions(configService).issuer,
      audience: getJwtVerifyOptions(configService).audience as string,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access' || !payload.jti || !payload.tokenVersion) {
      throw new UnauthorizedException('Access token required');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: { subAdminProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User no longer exists or has been purged.',
      );
    }
    // A version change invalidates every access and refresh token for the user.
    // Redis failure is fail-closed for authenticated requests.
    const activeVersion = await this.redisService.get(
      `refresh_version:${user.id}`,
    );
    if (!activeVersion || activeVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return {
      id: payload.sub,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      originalAdminId: payload.originalAdminId,
      assignedPermissions: user.subAdminProfile?.assignedPermissions ?? [],
    };
  }
}
