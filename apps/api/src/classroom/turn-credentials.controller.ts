import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TurnCredentialsService } from './turn-credentials.service.js';

@Controller('turn-credentials')
@UseGuards(JwtAuthGuard)
export class TurnCredentialsController {
  constructor(
    private readonly turnCredentialsService: TurnCredentialsService,
  ) {}

  @Get()
  async getIceServers() {
    return this.turnCredentialsService.getIceServers();
  }
}
