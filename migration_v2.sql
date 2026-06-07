-- =====================================================================
-- DEPAZ Student Council System — Database Migration v2
-- Run this entire script in your Supabase SQL Editor (once)
-- =====================================================================

-- ── 1. council_members: add auth + status columns ──────────────────
ALTER TABLE council_members
  ADD COLUMN IF NOT EXISTS password   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status     TEXT    DEFAULT 'active';

-- ── 2. council_events: rich public-facing activity records ─────────
CREATE TABLE IF NOT EXISTS council_events (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  description   TEXT        DEFAULT '',
  category      TEXT        DEFAULT 'กิจกรรมสภา',
  event_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  department_id BIGINT      REFERENCES council_departments(id) ON DELETE SET NULL,
  image_url     TEXT        DEFAULT '',
  location      TEXT        DEFAULT '',
  status        TEXT        DEFAULT 'published',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. council_event_participants: links events → members ──────────
CREATE TABLE IF NOT EXISTS council_event_participants (
  id        BIGSERIAL PRIMARY KEY,
  event_id  BIGINT NOT NULL REFERENCES council_events(id)  ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES council_members(id) ON DELETE CASCADE,
  role      TEXT   DEFAULT 'participant',
  UNIQUE(event_id, member_id)
);

-- ── 4. Row Level Security ──────────────────────────────────────────
ALTER TABLE council_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_event_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "public_read_events"       ON council_events;
DROP POLICY IF EXISTS "anon_write_events"        ON council_events;
DROP POLICY IF EXISTS "anon_event_participants"  ON council_event_participants;

-- Allow public reads (published only could be done with status check)
CREATE POLICY "public_read_events"
  ON council_events FOR SELECT USING (TRUE);

-- Allow anon key full write (app manages auth at app level)
CREATE POLICY "anon_write_events"
  ON council_events FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "anon_event_participants"
  ON council_event_participants FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── 5. Sample council_events data (optional — delete if not needed)
-- INSERT INTO council_events (title, description, category, event_date, location)
-- VALUES
--   ('ประชุมสภานักเรียนประจำเดือน', 'การประชุมติดตามงานและวางแผนกิจกรรม', 'ภาระหน้าที่', CURRENT_DATE - 7, 'ห้องประชุมโรงเรียน'),
--   ('กิจกรรมวันสิ่งแวดล้อม', 'สมาชิกสภาร่วมกันปลูกต้นไม้และทำความสะอาด', 'กิจกรรมสภา', CURRENT_DATE - 14, 'สนามโรงเรียน'),
--   ('อบรมภาวะผู้นำ', 'การอบรมพัฒนาทักษะการเป็นผู้นำของสมาชิกสภา', 'พัฒนาศักยภาพ', CURRENT_DATE - 21, 'ห้องโสตทัศนูปกรณ์');
