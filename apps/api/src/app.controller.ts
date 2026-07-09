import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'mrh-academy-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/integrations')
  async integrationHealth() {
    const integrations = await this.appService.getIntegrationStatus();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations,
    };
  }
}
