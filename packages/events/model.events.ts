import { BaseEvent } from './base.event';

export interface ModelActivatedPayload {
  modelId: string;
  name: string;
  type: string;
  version: string;
  activatedBy: number | null;
  activatedAt: string;
}

export type ModelActivatedEvent = BaseEvent<ModelActivatedPayload>;

export interface TrainingJobCompletedPayload {
  jobId: string;
  modelType: string;
  status: 'succeeded' | 'failed';
  resultModelVersionId: string | null;
  metrics: Record<string, number> | null;
  completedAt: string;
}

export type TrainingJobCompletedEvent = BaseEvent<TrainingJobCompletedPayload>;

export const ModelEventNames = {
  MODEL_ACTIVATED: 'model.activated',
  TRAINING_JOB_COMPLETED: 'model.training.completed',
} as const;
