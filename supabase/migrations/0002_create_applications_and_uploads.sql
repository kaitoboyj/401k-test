-- Migration: Create applications and application_uploads tables with RLS
-- Date: 2026-09-23
-- Project: USA 401k Grant Site

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Helper: set_updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- applications table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  app_id_short TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'submitted',
  ip TEXT,
  user_agent TEXT,
  visitor_session TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  personal JSONB NOT NULL DEFAULT '{}'::jsonb,
  banking JSONB NOT NULL DEFAULT '{}'::jsonb,
  business JSONB NOT NULL DEFAULT '{}'::jsonb,
  id_verify JSONB NOT NULL DEFAULT '{}'::jsonb,
  kaccess JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_applications_created_at_desc ON public.applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_app_id_short ON public.applications (app_id_short);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applications_insert_auth ON public.applications;
CREATE POLICY applications_insert_auth ON public.applications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS applications_insert_anon ON public.applications;
CREATE POLICY applications_insert_anon ON public.applications
  FOR INSERT WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS applications_select_own ON public.applications;
CREATE POLICY applications_select_own ON public.applications
  FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_applications_set_updated_at ON public.applications;
CREATE TRIGGER trg_applications_set_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- application_uploads table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.application_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_name TEXT,
  field_label TEXT,
  storage_object_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_uploads_application_id ON public.application_uploads (application_id);

ALTER TABLE public.application_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploads_insert_cascade ON public.application_uploads;
CREATE POLICY uploads_insert_cascade ON public.application_uploads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_uploads.application_id
        AND (a.user_id = auth.uid() OR a.user_id IS NULL)
    )
  );

DROP POLICY IF EXISTS uploads_select_own ON public.application_uploads;
CREATE POLICY uploads_select_own ON public.application_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_uploads.application_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage bucket: application-uploads (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('application-uploads', 'application-uploads', false, 25 * 1024 * 1024, ARRAY[
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'image/tiff', 'image/bmp'
])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS policies on storage.objects
-- ============================================================
DROP POLICY IF EXISTS application_uploads_users_insert ON storage.objects;
CREATE POLICY application_uploads_users_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'application-uploads'
    AND (
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR (auth.uid() IS NULL AND (storage.foldername(name))[1] = 'anon')
    )
  );

DROP POLICY IF EXISTS application_uploads_users_select ON storage.objects;
CREATE POLICY application_uploads_users_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'application-uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
