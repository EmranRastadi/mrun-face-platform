-- ClickHouse schema init (runs on first boot).
CREATE DATABASE IF NOT EXISTS mrun;

CREATE TABLE IF NOT EXISTS mrun.audit_events (
    event_id      String,
    event_name    String,
    actor         String,
    action        String,
    resource_type String,
    resource_id   String,
    outcome       String,
    ip            String,
    occurred_on   DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (occurred_on, resource_type, resource_id);
