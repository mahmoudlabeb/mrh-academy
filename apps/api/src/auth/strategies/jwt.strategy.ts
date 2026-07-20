import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
  sessionId?: string;
  type?: 'access' | 'refresh';
  originalAdminId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.mrh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type && payload.type !== 'access') {
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
    return {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      sessionId: payload.sessionId,
      originalAdminId: payload.originalAdminId,
      assignedPermissions: user.subAdminProfile?.assignedPermissions ?? [],
    };
  }
}
