import { BaseEvent } from './base.event';

export interface VisionFramePayload {
  cameraId: string;
  frameId: string;
  frameKey: string;
  capturedAt: string;
  width: number;
  height: number;
  storageKey: string;
  thumbnailKey: string | null;
  organizationId: string | null;
}

export type VisionFrameEvent = BaseEvent<VisionFramePayload>;

export interface VisionDetectionPayload {
  cameraId: string;
  frameId: string;
  frameKey: string;
  capturedAt: string;
  organizationId: string | null;
  detections: Array<{
    id: string;
    type: string;
    bbox: { x: number; y: number; width: number; height: number };
    score: number;
    zoneIds: string[];
    attributes: Record<string, unknown>;
  }>;
  modelVersions: Record<string, string>;
}

export type VisionDetectionEvent = BaseEvent<VisionDetectionPayload>;

export interface EmbeddingCreatedPayload {
  personId?: string;
  frameId: string;
  frameKey: string;
  embeddingId: string;
  dimension: number;
  cameraId: string;
  detectionId: string;
  quality: number;
  modelVersion: string;
}

export type EmbeddingCreatedEvent = BaseEvent<EmbeddingCreatedPayload>;

export const VisionEventNames = {
  FRAME_CAPTURED: 'vision.frame.captured',
  DETECTION_COMPLETED: 'vision.detection.completed',
  EMBEDDING_CREATED: 'vision.embedding.created',
} as const;
