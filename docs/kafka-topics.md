# Kafka Topics

Defined in `packages/events/topics/kafka-topics.ts`. Single source of truth.

| Topic | Producer | Consumer | Key |
|---|---|---|---|
| `user.events` | users-service | gateway/audit | userId |
| `card.events` | cards-service | worker/audit | cardId |
| `enrollment.events` | enrollment-service | audit/notification | personId |
| `camera.events` | camera-service | worker-service | cameraId |
| `vision.events` | worker-service | similarity-service | cameraId |
| `embedding.events` | worker-service | similarity-service | personId |
| `recognition.events` | similarity-service | audit/notification | personId |
| `audit.events` | all | audit-service | aggregateId |
| `notification.events` | gateway/notification | notification-service | userId |
| `system.events` | all | monitoring | serviceName |

Consumer groups (`packages/events/topics/consumer-groups.ts`):
`recognition-workers`, `audit-workers`, `notification-workers`, `enrollment-workers`.

Partition keys: `packages/events/topics/partition-keys.ts`.
