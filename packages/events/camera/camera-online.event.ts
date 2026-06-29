import type { BaseEvent } from '../base/base.event';

export interface CameraOnlinePayload {
  cameraId: string;
  locationId: string;
}

export type CameraOnlineEvent =
  BaseEvent<CameraOnlinePayload>;