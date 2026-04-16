import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import amqplib from 'amqplib';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private readonly logger = new Logger(MessagingService.name);

  async onModuleInit() {
    try {
      const url = process.env['BROKER_URL'] || 'amqp://guest:guest@localhost:5672';
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.warn('RabbitMQ not available, events will be logged only', error);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(exchange: string, routingKey: string, message: unknown): Promise<void> {
    const payload = Buffer.from(JSON.stringify(message));

    if (this.channel) {
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
      this.channel.publish(exchange, routingKey, payload, {
        persistent: true,
        contentType: 'application/json',
      });
      this.logger.debug(`Published ${routingKey} to ${exchange}`);
    } else {
      this.logger.warn(`RabbitMQ unavailable — event dropped: ${routingKey}`, JSON.stringify(message));
    }
  }
}
