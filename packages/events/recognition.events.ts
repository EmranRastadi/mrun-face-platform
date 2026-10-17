import { BaseEvent } from './base.event';

export interface RecognitionCompletedPayload {
  personId: string;
  cameraId: string;
  confidence: number;
  matched: boolean;
  frameKey?: string;
  latencyMs?: number;
}

export type RecognitionCompletedEvent = BaseEvent<RecognitionCompletedPayload>;

export const RecognitionEventNames = {
  RECOGNITION_COMPLETED: 'recognition.completed',
} as const;
