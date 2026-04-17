import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      data: { status: 'ok' },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
