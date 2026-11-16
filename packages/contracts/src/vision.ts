export enum CameraKind {
  RTSP = 'rtsp',
  HTTP = 'http',
  USB = 'usb',
  WEBRTC = 'webrtc',
}

export enum CameraStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  DISABLED = 'disabled',
}

export enum ZoneType {
  INCLUSION = 'inclusion',
  EXCLUSION = 'exclusion',
  COUNTING = 'counting',
  RESTRICTED = 'restricted',
}

export interface Camera {
  id: string;
  organization_id: string;
  name: string;
  kind: CameraKind;
  stream_url: string | null;
  status: CameraStatus;
  resolution_width: number | null;
  resolution_height: number | null;
  sample_fps: number;
  location: string | null;
  timezone: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZonePolygonPoint {
  x: number;
  y: number;
}

export interface Zone {
  id: string;
  camera_id: string;
  organization_id: string;
  name: string;
  type: ZoneType;
  polygon: ZonePolygonPoint[];
  color: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Frame {
  id: string;
  camera_id: string;
  captured_at: string;
  width: number;
  height: number;
  storage_key: string;
  thumbnail_key: string | null;
}

export interface CreateCameraPayload {
  organizationId: string;
  name: string;
  kind: CameraKind;
  streamUrl?: string | null;
  sampleFps?: number;
  location?: string | null;
  timezone?: string;
}

export interface UpdateCameraPayload {
  name?: string;
  streamUrl?: string | null;
  sampleFps?: number;
  location?: string | null;
  timezone?: string;
  enabled?: boolean;
  status?: CameraStatus;
}

export interface CreateZonePayload {
  cameraId: string;
  organizationId: string;
  name: string;
  type: ZoneType;
  polygon: ZonePolygonPoint[];
  color?: string | null;
}

export interface UpdateZonePayload {
  name?: string;
  type?: ZoneType;
  polygon?: ZonePolygonPoint[];
  color?: string | null;
  enabled?: boolean;
}
