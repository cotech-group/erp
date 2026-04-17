import { Consumer } from './consumer.js';
import { handleMediaUploaded } from './handlers/media-uploaded.js';
import { logger } from './logger.js';

const BROKER_URL = process.env['BROKER_URL'] || 'amqp://guest:guest@localhost:5672';
const EXCHANGE = 'media.events';
const QUEUE = 'worker.media.processing';
const DLQ = 'worker.media.processing.dlq';
const MAX_RETRIES = 3;

async function main() {
  logger.info('Worker node starting...', { brokerUrl: BROKER_URL });

  const consumer = new Consumer(BROKER_URL, EXCHANGE, QUEUE, DLQ, MAX_RETRIES);

  // Register handlers
  consumer.registerHandler('media.uploaded', handleMediaUploaded);

  // Graceful shutdown
  const shutdown = async () => {
    await consumer.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await consumer.start();
    logger.info('Worker node ready, waiting for messages...');
  } catch (error) {
    logger.error('Failed to start worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main();
