export const KafkaTopics = {
  CARD: 'card.events',
  USER: 'user.events',
  ENROLLMENT: 'enrollment.events',
  CAMERA: 'camera.events',
  VISION: 'vision.events',
  EMBEDDING: 'embedding.events',
  RECOGNITION: 'recognition.events',
  AUDIT: 'audit.events',
  NOTIFICATION: 'notification.events',
  SYSTEM: 'system.events',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];
