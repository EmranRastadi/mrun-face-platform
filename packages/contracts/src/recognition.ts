export enum RecognitionDecision {
  MATCH = 'match',
  NO_MATCH = 'no_match',
  UNKNOWN = 'unknown',
  LOW_QUALITY = 'low_quality',
}

export interface RecognitionMatch {
  person_id: string | null;
  score: number;
  decision: RecognitionDecision;
  card_id: string | null;
  zone_ids: string[];
  detection_id: string;
  frame_id: string;
}

export interface RecognitionResult {
  id: string;
  camera_id: string;
  frame_id: string;
  organization_id: string | null;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  matches: RecognitionMatch[];
  unknown_count: number;
  model_versions: Record<string, string>;
}

export interface RecognizeRequest {
  embedding: number[];
  topK?: number;
  organizationId?: string | null;
  cameraId?: string | null;
  zoneIds?: string[];
  threshold?: number;
}

export interface RecognizeResponse {
  matches: Array<{ id: string; score: number }>;
  took_ms: number;
}
