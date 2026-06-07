-- =====================================================================
-- DEPAZ Student Council System — Database Migration v3
-- Certificate Campaigns & Issued Certificates
-- Run this entire script in your Supabase SQL Editor (once)
-- =====================================================================

-- ── 1. Certificate Campaigns ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS council_cert_campaigns (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'activity', -- 'activity' | 'duty'
  description TEXT        DEFAULT '',
  template_url TEXT       DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Issued Certificates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS council_certificates (
  id          BIGSERIAL PRIMARY KEY,
  member_id   BIGINT      NOT NULL REFERENCES council_members(id) ON DELETE CASCADE,
  campaign_id BIGINT      NOT NULL REFERENCES council_cert_campaigns(id) ON DELETE CASCADE,
  issued_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, campaign_id)
);

-- ── 3. RLS ─────────────────────────────────────────────────────────
ALTER TABLE council_cert_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_certificates   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all_cert_campaigns" ON council_cert_campaigns;
DROP POLICY IF EXISTS "public_all_certificates"   ON council_certificates;

CREATE POLICY "public_all_cert_campaigns"
  ON council_cert_campaigns FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "public_all_certificates"
  ON council_certificates FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── 4. Supabase Storage bucket for templates ───────────────────────
-- Run this separately in the Supabase Dashboard → SQL Editor:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('cert-templates', 'cert-templates', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "public read cert-templates"
--   ON storage.objects FOR SELECT USING (bucket_id = 'cert-templates');
--
-- CREATE POLICY "public upload cert-templates"
--   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cert-templates');
--
-- CREATE POLICY "public delete cert-templates"
--   ON storage.objects FOR DELETE USING (bucket_id = 'cert-templates');
