import { BaseEvent } from './base.event';

export interface RecognitionCompletedPayload {
  recognitionId: string;
  personId: string | null;
  cameraId: string;
  frameId: string | null;
  confidence: number;
  matched: boolean;
  decision: 'match' | 'no_match' | 'unknown' | 'low_quality';
  zoneIds: string[];
  cardIds: string[];
  latencyMs: number;
  modelVersions: Record<string, string>;
  organizationId: string | null;
}

export type RecognitionCompletedEvent = BaseEvent<RecognitionCompletedPayload>;

export const RecognitionEventNames = {
  RECOGNITION_COMPLETED: 'recognition.completed',
  RECOGNITION_FAILED: 'recognition.failed',
} as const;
