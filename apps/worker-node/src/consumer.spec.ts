import { Consumer } from './consumer';

// Mock amqplib
jest.mock('amqplib', () => ({
  default: {
    connect: jest.fn(),
  },
}));

describe('Consumer', () => {
  it('should register handlers', () => {
    const consumer = new Consumer('amqp://localhost', 'test', 'queue', 'dlq');
    const handler = jest.fn();

    consumer.registerHandler('test.event', handler);

    // Verify handler is registered (internal state)
    expect((consumer as any).handlers.has('test.event')).toBe(true);
  });

  it('should have correct config', () => {
    const consumer = new Consumer('amqp://localhost', 'exchange', 'queue', 'dlq', 5);

    expect((consumer as any).brokerUrl).toBe('amqp://localhost');
    expect((consumer as any).exchange).toBe('exchange');
    expect((consumer as any).queue).toBe('queue');
    expect((consumer as any).dlqQueue).toBe('dlq');
    expect((consumer as any).maxRetries).toBe(5);
  });
});
