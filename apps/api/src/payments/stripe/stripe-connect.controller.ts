import {
  Controller,
  Get,
  Post,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { StripeService } from './stripe.service.js';
import { UserRole } from '@mrh/types';
import { TutorProfile } from '../../entities/tutor-profile.entity.js';

@Controller('stripe/connect')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StripeConnectController {
  private readonly logger = new Logger(StripeConnectController.name);

  constructor(
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    private readonly stripeService: StripeService,
  ) {}

  @Post('onboarding')
  @Roles(UserRole.TUTOR)
  async startOnboarding(@CurrentUser() user: { id: string; email: string }) {
    try {
      const profile = await this.tutorProfileRepository.findOne({
        where: { userId: user.id },
      });
      if (!profile) throw new BadRequestException('Tutor profile not found');

      let accountId = profile.stripeAccountId;

      if (!accountId) {
        const account = await this.stripeService.createConnectedAccount(
          user.email,
        );
        accountId = account.id;
        await this.tutorProfileRepository.update(user.id, {
          stripeAccountId: accountId,
        });
      }

      const url = await this.stripeService.generateOnboardingLink(accountId);
      return { url };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Stripe onboarding failed for user ${user.id}:`, err);
      throw new BadRequestException(
        'Failed to initialize Stripe onboarding. Please try again later.',
      );
    }
  }

  @Get('status')
  @Roles(UserRole.TUTOR)
  async getStatus(@CurrentUser() user: { id: string }) {
    const profile = await this.tutorProfileRepository.findOne({
      where: { userId: user.id },
    });
    if (!profile) return { connected: false, onboardingComplete: false };

    return {
      connected: Boolean(profile.stripeAccountId),
      onboardingComplete: profile.stripeOnboardingComplete,
      stripeAccountId: profile.stripeAccountId,
    };
  }
}
