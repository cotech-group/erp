import amqplib from 'amqplib';
import { logger } from './logger.js';

export interface JobMessage {
  jobId: string;
  idempotencyKey: string;
  correlationId: string;
  attempt: number;
  payloadVersion: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type JobHandler = (job: JobMessage) => Promise<void>;

export class Consumer {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private handlers = new Map<string, JobHandler>();
  private shuttingDown = false;

  constructor(
    private readonly brokerUrl: string,
    private readonly exchange: string,
    private readonly queue: string,
    private readonly dlqQueue: string,
    private readonly maxRetries: number = 3,
  ) {}

  registerHandler(routingKey: string, handler: JobHandler) {
    this.handlers.set(routingKey, handler);
    logger.info(`Handler registered for ${routingKey}`);
  }

  async start() {
    this.connection = await amqplib.connect(this.brokerUrl);
    this.channel = await this.connection.createChannel();

    // Setup exchange
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

    // Setup DLQ
    await this.channel.assertQueue(this.dlqQueue, { durable: true });

    // Setup main queue with DLQ
    await this.channel.assertQueue(this.queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.dlqQueue,
      },
    });

    // Bind all registered routing keys
    for (const routingKey of this.handlers.keys()) {
      await this.channel.bindQueue(this.queue, this.exchange, routingKey);
      logger.info(`Bound ${this.queue} to ${this.exchange} with key ${routingKey}`);
    }

    // Prefetch 1 message at a time
    await this.channel.prefetch(1);

    // Start consuming
    await this.channel.consume(this.queue, async (msg) => {
      if (!msg || this.shuttingDown) return;

      const start = Date.now();
      let job: JobMessage | null = null;

      try {
        job = JSON.parse(msg.content.toString()) as JobMessage;
        const routingKey = msg.fields.routingKey;
        const handler = this.handlers.get(routingKey);

        if (!handler) {
          logger.warn(`No handler for routing key: ${routingKey}`, { jobId: job.jobId });
          this.channel!.nack(msg, false, false); // send to DLQ
          return;
        }

        logger.info(`Processing job`, {
          jobId: job.jobId,
          type: job.type,
          correlationId: job.correlationId,
          attempt: job.attempt,
        });

        await handler(job);

        const duration = Date.now() - start;
        logger.info(`Job completed`, { jobId: job.jobId, type: job.type, duration });
        this.channel!.ack(msg);
      } catch (error) {
        const duration = Date.now() - start;
        const attempt = job?.attempt ?? 1;
        const errorMsg = error instanceof Error ? error.message : String(error);

        logger.error(`Job failed`, {
          jobId: job?.jobId,
          type: job?.type,
          attempt,
          duration,
          error: errorMsg,
        });

        if (attempt >= this.maxRetries) {
          logger.error(`Job sent to DLQ after ${attempt} attempts`, { jobId: job?.jobId });
          this.channel!.nack(msg, false, false); // send to DLQ
        } else {
          // Requeue for retry
          this.channel!.nack(msg, false, true);
        }
      }
    });

    logger.info(`Consumer started on queue ${this.queue}`);
  }

  async shutdown() {
    this.shuttingDown = true;
    logger.info('Shutting down consumer...');
    await this.channel?.close();
    await this.connection?.close();
    logger.info('Consumer shut down');
  }
}
