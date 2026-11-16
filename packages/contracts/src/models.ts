export enum ModelType {
  FACE_DETECTION = 'face_detection',
  FACE_EMBEDDING = 'face_embedding',
  CARD_DETECTION = 'card_detection',
  CARD_OCR = 'card_ocr',
  OBJECT_DETECTION = 'object_detection',
}

export enum ModelStatus {
  DRAFT = 'draft',
  TRAINING = 'training',
  EVALUATING = 'evaluating',
  ACTIVE = 'active',
  RETIRED = 'retired',
  FAILED = 'failed',
}

export enum TrainingJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ModelVersion {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  storage_key: string;
  metrics: Record<string, number> | null;
  status: ModelStatus;
  created_by: number | null;
  created_at: string;
  activated_at: string | null;
}

export interface TrainingJob {
  id: string;
  model_type: ModelType;
  status: TrainingJobStatus;
  dataset_key: string | null;
  base_model_version_id: string | null;
  result_model_version_id: string | null;
  metrics: Record<string, number> | null;
  error: string | null;
  created_by: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateTrainingJobPayload {
  modelType: ModelType;
  datasetKey?: string;
  baseModelVersionId?: string;
}
