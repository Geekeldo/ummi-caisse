-- ═══════════════════════════════════════════════════════════
-- Le Barista — Migration 007 : Paramètres de l'application
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs connectés peuvent lire
CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (true);

-- Seuls les admins peuvent modifier
CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Valeurs par défaut
INSERT INTO public.app_settings (key, value)
VALUES
  ('logo_url', ''),
  ('app_name', 'Le Barista')
ON CONFLICT (key) DO NOTHING;

-- ── Bucket storage "brand" ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand',
  'brand',
  true,
  5242880,  -- 5 MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (logo visible sans authentification)
DROP POLICY IF EXISTS "Public read brand" ON storage.objects;
CREATE POLICY "Public read brand"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand');

-- Upload / écrasement pour les utilisateurs connectés
DROP POLICY IF EXISTS "Auth upload brand" ON storage.objects;
CREATE POLICY "Auth upload brand"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand');

DROP POLICY IF EXISTS "Auth update brand" ON storage.objects;
CREATE POLICY "Auth update brand"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand');

DROP POLICY IF EXISTS "Auth delete brand" ON storage.objects;
CREATE POLICY "Auth delete brand"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand');
