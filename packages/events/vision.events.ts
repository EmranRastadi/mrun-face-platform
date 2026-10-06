import { BaseEvent } from './base.event';

export interface VisionFramePayload {
  cameraId: string;
  frameKey: string;
  capturedAt: string;
}

export type VisionFrameEvent = BaseEvent<VisionFramePayload>;

export interface EmbeddingCreatedPayload {
  personId?: string;
  frameKey: string;
  embeddingId: string;
  dimension: number;
}

export type EmbeddingCreatedEvent = BaseEvent<EmbeddingCreatedPayload>;

export const VisionEventNames = {
  FRAME_CAPTURED: 'vision.frame.captured',
  EMBEDDING_CREATED: 'vision.embedding.created',
} as const;
