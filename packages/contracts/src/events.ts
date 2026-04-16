export const EventTypes = {
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_PROCESSING_REQUESTED: 'media.processing.requested',
  MEDIA_PROCESSING_COMPLETED: 'media.processing.completed',
  MEDIA_PROCESSING_FAILED: 'media.processing.failed',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface JobEnvelope<T = unknown> {
  jobId: string;
  idempotencyKey: string;
  correlationId: string;
  attempt: number;
  payloadVersion: number;
  type: EventType;
  payload: T;
  createdAt: string;
}

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled';
