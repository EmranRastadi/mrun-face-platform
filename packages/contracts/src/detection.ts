export enum DetectionType {
  FACE = 'face',
  CARD = 'card',
  PERSON = 'person',
  VEHICLE = 'vehicle',
  OBJECT = 'object',
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  frame_id: string;
  camera_id: string;
  type: DetectionType;
  bbox: BBox;
  score: number;
  zone_ids: string[];
  created_at: string;
}

export interface FaceAttributes {
  quality: number;
  blur: number | null;
  brightness: number | null;
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  age_estimate: number | null;
  gender_estimate: string | null;
}

export interface FaceDetection extends Detection {
  type: DetectionType.FACE;
  attributes: FaceAttributes;
  embedding_ref: string | null;
  landmarks: number[][] | null;
}

export interface CardAttributes {
  card_class: string;
  ocr_number: string | null;
  ocr_expiry: string | null;
  ocr_name: string | null;
}

export interface CardDetection extends Detection {
  type: DetectionType.CARD;
  attributes: CardAttributes;
}

export interface EmbeddingVector {
  id: string;
  frame_id: string;
  camera_id: string;
  detection_id: string;
  person_id: string | null;
  vector: number[];
  dimension: number;
  model_version: string;
  quality: number;
  created_at: string;
}
