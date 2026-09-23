-- Applications table: stores every submitted grant application
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_number text,
  personal jsonb NOT NULL DEFAULT '{}'::jsonb,
  banking jsonb NOT NULL DEFAULT '{}'::jsonb,
  business jsonb NOT NULL DEFAULT '{}'::jsonb,
  id_verify jsonb NOT NULL DEFAULT '{}'::jsonb,
  kaccess jsonb NOT NULL DEFAULT '{}'::jsonb,
  final jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own applications" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own applications" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_check(pw text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT pw = 'Bethebest1rr';
$$;
GRANT EXECUTE ON FUNCTION public.admin_check(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles(pw text)
RETURNS SETOF public.profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.admin_check(pw) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_applications(pw text)
RETURNS SETOF public.applications
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.admin_check(pw) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.applications ORDER BY created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_applications(text) TO anon, authenticated;
