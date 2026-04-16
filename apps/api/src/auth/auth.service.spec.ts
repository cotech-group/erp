// Mock PrismaService to avoid importing the generated Prisma client (ESM)
jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { [key: string]: any };
  let jwtService: JwtService;
  let auditService: AuditService;

  const mockUser = {
    id: 'user-1',
    email: 'test@ina.fr',
    password: '', // will be set in beforeAll
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    mfaEnabled: false,
    odooUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [
      {
        role: { id: 'role-1', name: 'editor', description: null, createdAt: new Date() },
        userId: 'user-1',
        roleId: 'role-1',
        assignedAt: new Date(),
      },
    ],
  };

  beforeAll(async () => {
    mockUser.password = await argon2.hash('password123');
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      session: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-access-token'),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'test@ina.fr', password: 'password123' },
        '127.0.0.1',
      );

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login', userId: 'user-1' }),
      );
    });

    it('should throw on invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'bad@ina.fr', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'test@ina.fr', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'test@ina.fr', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens on valid refresh token', async () => {
      const storedToken = {
        id: 'token-1',
        token: 'valid-refresh-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        replacedBy: null,
        createdAt: new Date(),
        user: mockUser,
      };

      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw on expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'expired-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 86400000), // expired
        revokedAt: null,
        user: mockUser,
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke all tokens on reuse of revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'reused-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // already revoked
        user: mockUser,
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke all tokens and sessions', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'logout', userId: 'user-1' }),
      );
    });
  });
});
