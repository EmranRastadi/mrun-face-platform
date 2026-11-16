import { BaseEvent } from './base.event';

export interface ZoneCrossingPayload {
  zoneId: string;
  cameraId: string;
  organizationId: string | null;
  detectionId: string;
  detectionType: string;
  entered: boolean;
  timestamp: string;
}

export type ZoneCrossingEvent = BaseEvent<ZoneCrossingPayload>;

export interface ZoneOccupancyPayload {
  zoneId: string;
  cameraId: string;
  organizationId: string | null;
  count: number;
  timestamp: string;
}

export type ZoneOccupancyEvent = BaseEvent<ZoneOccupancyPayload>;

export const ZoneEventNames = {
  ZONE_CROSSING: 'zone.crossing',
  ZONE_OCCUPANCY: 'zone.occupancy',
} as const;
