import { OdooClientService } from './odoo-client.service';

describe('OdooClientService', () => {
  let service: OdooClientService;

  beforeEach(() => {
    process.env['ODOO_URL'] = 'http://localhost:8069';
    process.env['ODOO_DB'] = 'test_db';
    process.env['ODOO_USER'] = 'admin';
    process.env['ODOO_PASSWORD'] = 'admin';

    service = new OdooClientService();
    service.onModuleInit();
  });

  describe('circuit breaker', () => {
    it('should open after threshold failures', async () => {
      // Simulate failures by calling with bad URL
      const original = (service as any).config.url;
      (service as any).config.url = 'http://localhost:1'; // unreachable
      (service as any).config.timeout = 500;
      (service as any).config.maxRetries = 1;

      // Trigger failures up to threshold
      for (let i = 0; i < 5; i++) {
        try {
          await service.authenticate();
        } catch {
          // expected
        }
      }

      // Next call should fail with circuit breaker message
      try {
        await service.authenticate();
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('circuit breaker open');
      }

      (service as any).config.url = original;
    });

    it('should reset after timeout', async () => {
      (service as any).failures = 5;
      (service as any).lastFailure = Date.now() - 31_000; // past reset timeout

      // Should not throw circuit breaker error (half-open)
      try {
        await service.authenticate();
      } catch (error: any) {
        // Will fail because Odoo isn't running, but NOT with circuit breaker message
        expect(error.message).not.toContain('circuit breaker open');
      }
    });
  });

  describe('configuration', () => {
    it('should read config from env vars', () => {
      const config = (service as any).config;
      expect(config.url).toBe('http://localhost:8069');
      expect(config.db).toBe('test_db');
      expect(config.username).toBe('admin');
      expect(config.timeout).toBe(10_000);
      expect(config.maxRetries).toBe(3);
    });
  });
});
