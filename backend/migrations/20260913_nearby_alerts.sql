ALTER TABLE users ADD COLUMN IF NOT EXISTS nearby_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_latitude NUMERIC(8,5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_longitude NUMERIC(8,5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_location geometry(Point,4326);
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_location_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_alert_location ON users USING GIST(alert_location);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(64) NOT NULL DEFAULT 'OPERATIONAL';
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_user_event_type
ON notifications (user_id, event_id, notification_type)
WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id) WHERE is_active;
