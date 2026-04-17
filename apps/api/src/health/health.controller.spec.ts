jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { isHealthy: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return ok status', () => {
    const result = controller.check();
    expect(result.data.status).toBe('ok');
    expect(result.meta.timestamp).toBeDefined();
  });

  it('should return readiness with database check', async () => {
    const result = await controller.readiness();
    expect(result.data.status).toBe('ready');
    expect(result.data.checks.database).toBe('up');
  });
});
