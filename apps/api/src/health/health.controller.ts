import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store')
  check() {
    return {
      data: { status: 'ok' },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-cache, no-store')
  async readiness() {
    const checks: Record<string, 'up' | 'down'> = {};

    checks['database'] = (await this.prisma.isHealthy()) ? 'up' : 'down';

    const allUp = Object.values(checks).every((v) => v === 'up');

    return {
      data: {
        status: allUp ? 'ready' : 'degraded',
        checks,
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
