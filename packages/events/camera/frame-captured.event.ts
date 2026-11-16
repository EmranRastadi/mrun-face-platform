export interface FrameCaptured {
  cameraId: string;
  frameId: string;
  timestamp: string;
  imageUrl: string;
  width: number;
  height: number;
  storageKey: string;
  organizationId: string | null;
}
