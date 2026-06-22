-- 1. Create Profiles & Preferences Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.nm_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    experience TEXT,
    preferred_roles TEXT[] DEFAULT '{}'::TEXT[],
    preferred_locations TEXT[] DEFAULT '{}'::TEXT[],
    startup_stages TEXT,
    email_alerts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Job Applications Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.nm_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS) on newly created tables
ALTER TABLE public.nm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nm_applications ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for nm_profiles (checking for existence to avoid conflicts)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_profiles' AND policyname = 'nm_policy_select_own_profile'
    ) THEN
        CREATE POLICY nm_policy_select_own_profile ON public.nm_profiles
            FOR SELECT USING (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_profiles' AND policyname = 'nm_policy_insert_own_profile'
    ) THEN
        CREATE POLICY nm_policy_insert_own_profile ON public.nm_profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_profiles' AND policyname = 'nm_policy_update_own_profile'
    ) THEN
        CREATE POLICY nm_policy_update_own_profile ON public.nm_profiles
            FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;

-- 5. Create Policies for nm_applications (checking for existence to avoid conflicts)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_applications' AND policyname = 'nm_policy_select_own_applications'
    ) THEN
        CREATE POLICY nm_policy_select_own_applications ON public.nm_applications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_applications' AND policyname = 'nm_policy_insert_own_applications'
    ) THEN
        CREATE POLICY nm_policy_insert_own_applications ON public.nm_applications
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 6. Create Startups Table
CREATE TABLE IF NOT EXISTS public.nm_startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    funding_stage TEXT NOT NULL,
    funding_amount TEXT NOT NULL,
    funding_date DATE NOT NULL,
    website TEXT,
    location TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Jobs Table
CREATE TABLE IF NOT EXISTS public.nm_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id UUID REFERENCES public.nm_startups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    apply_link TEXT NOT NULL,
    job_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.nm_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nm_jobs ENABLE ROW LEVEL SECURITY;

-- 9. Create public SELECT policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_startups' AND policyname = 'nm_policy_select_startups'
    ) THEN
        CREATE POLICY nm_policy_select_startups ON public.nm_startups
            FOR SELECT USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_jobs' AND policyname = 'nm_policy_select_jobs'
    ) THEN
        CREATE POLICY nm_policy_select_jobs ON public.nm_jobs
            FOR SELECT USING (true);
    END IF;
END
$$;

-- 10. Pre-populate Startups with static UUIDs
INSERT INTO public.nm_startups (id, name, funding_stage, funding_amount, funding_date, website, location, description)
VALUES 
    ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Nebula AI', 'Series A', '$12M', '2026-05-15', 'https://nebula.ai', 'Bengaluru', 'Building decentralized compute infrastructure for the next generation of large language models.'),
    ('b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Flux Dynamics', 'Seed', '$3.5M', '2026-06-01', 'https://fluxdynamics.io', 'Mumbai', 'Real-time supply chain optimization using autonomous drones and proprietary predictive analytics.'),
    ('c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Cortex Labs', 'Series B', '$28M', '2026-04-20', 'https://cortexlabs.co', 'Remote', 'Next-generation AI agents and workflows for automating developer and enterprise operations.'),
    ('d4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Apex Systems', 'Series C', '$45M', '2026-03-10', 'https://apexsystems.com', 'Pune', 'Enterprise resource orchestration and data pipelines for manufacturing automation.'),
    ('e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', 'Velo Mobility', 'Series A', '$8M', '2026-05-30', 'https://velomobility.com', 'Delhi NCR', 'Smart electric micro-mobility networks and hardware-software platforms for city transit.')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    funding_stage = EXCLUDED.funding_stage,
    funding_amount = EXCLUDED.funding_amount,
    funding_date = EXCLUDED.funding_date,
    website = EXCLUDED.website,
    location = EXCLUDED.location,
    description = EXCLUDED.description;

-- 11. Pre-populate Jobs with references to the static UUIDs
INSERT INTO public.nm_jobs (id, startup_id, title, location, apply_link, job_type)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Product Manager', 'Bengaluru', 'https://nebula.ai/careers/pm', 'Full-time'),
    ('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Frontend Engineer', 'Remote', 'https://nebula.ai/careers/frontend', 'Full-time'),
    ('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Data Scientist', 'Bengaluru', 'https://nebula.ai/careers/ds', 'Full-time'),
    ('44444444-4444-4444-4444-444444444444', 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Associate Product Manager', 'Mumbai', 'https://fluxdynamics.io/careers/apm', 'Full-time'),
    ('55555555-5555-5555-5555-555555555555', 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'Backend Engineer', 'Remote', 'https://fluxdynamics.io/careers/backend', 'Full-time'),
    ('66666666-6666-6666-6666-666666666666', 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'UX Designer', 'Remote', 'https://cortexlabs.co/careers/ux', 'Full-time'),
    ('77777777-7777-7777-7777-777777777777', 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'Frontend Engineer', 'Remote', 'https://cortexlabs.co/careers/frontend-intern', 'Internship'),
    ('88888888-8888-8888-8888-888888888888', 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Product Manager', 'Pune', 'https://apexsystems.com/careers/pm', 'Full-time'),
    ('99999999-9999-9999-9999-999999999999', 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Associate Product Manager', 'Pune', 'https://apexsystems.com/careers/apm', 'Full-time'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a', 'Data Scientist', 'Pune', 'https://apexsystems.com/careers/ds', 'Full-time'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', 'Frontend Engineer', 'Delhi NCR', 'https://velomobility.com/careers/frontend', 'Contract'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', 'UX Designer', 'Delhi NCR', 'https://velomobility.com/careers/ux', 'Full-time')
ON CONFLICT (id) DO UPDATE SET
    startup_id = EXCLUDED.startup_id,
    title = EXCLUDED.title,
    location = EXCLUDED.location,
    apply_link = EXCLUDED.apply_link,
    job_type = EXCLUDED.job_type;

-- 12. Add email column to nm_profiles to send alerts
ALTER TABLE public.nm_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 13. Create Email Logs Table
CREATE TABLE IF NOT EXISTS public.nm_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Enable RLS on nm_email_logs
ALTER TABLE public.nm_email_logs ENABLE ROW LEVEL SECURITY;

-- 15. Select policy for users to see their own email logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_email_logs' AND policyname = 'nm_policy_select_own_email_logs'
    ) THEN
        CREATE POLICY nm_policy_select_own_email_logs ON public.nm_email_logs
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 16. Insert policy for nm_email_logs (needed by background job)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_email_logs' AND policyname = 'nm_policy_insert_email_logs'
    ) THEN
        CREATE POLICY nm_policy_insert_email_logs ON public.nm_email_logs
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 17. Insert policy for nm_startups (needed by background job)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_startups' AND policyname = 'nm_policy_insert_startups'
    ) THEN
        CREATE POLICY nm_policy_insert_startups ON public.nm_startups
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 18. Insert policy for nm_jobs (needed by background job)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_jobs' AND policyname = 'nm_policy_insert_jobs'
    ) THEN
        CREATE POLICY nm_policy_insert_jobs ON public.nm_jobs
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 19. Add source_url column to nm_startups to store where the funding news was found
ALTER TABLE public.nm_startups ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 20. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.nm_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. Enable RLS on nm_notifications
ALTER TABLE public.nm_notifications ENABLE ROW LEVEL SECURITY;

-- 22. Select policy for users to see their own notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_notifications' AND policyname = 'nm_policy_select_own_notifications'
    ) THEN
        CREATE POLICY nm_policy_select_own_notifications ON public.nm_notifications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 23. Insert policy for nm_notifications (needed by background job)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_notifications' AND policyname = 'nm_policy_insert_notifications'
    ) THEN
        CREATE POLICY nm_policy_insert_notifications ON public.nm_notifications
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 24. Create Processed Articles Table
CREATE TABLE IF NOT EXISTS public.nm_processed_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url TEXT UNIQUE NOT NULL,
    title TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 25. Enable RLS on nm_processed_articles
ALTER TABLE public.nm_processed_articles ENABLE ROW LEVEL SECURITY;

-- 26. Select policy for processed articles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_processed_articles' AND policyname = 'nm_policy_select_processed_articles'
    ) THEN
        CREATE POLICY nm_policy_select_processed_articles ON public.nm_processed_articles
            FOR SELECT USING (true);
    END IF;
END
$$;

-- 27. Insert policy for processed articles (needed by background job)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'nm_processed_articles' AND policyname = 'nm_policy_insert_processed_articles'
    ) THEN
        CREATE POLICY nm_policy_insert_processed_articles ON public.nm_processed_articles
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;
-- 28. Create fj_profiles Table
CREATE TABLE IF NOT EXISTS public.fj_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    experience TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 29. Create fj_preferences Table
CREATE TABLE IF NOT EXISTS public.fj_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_roles TEXT[] DEFAULT '{}'::TEXT[],
    preferred_locations TEXT[] DEFAULT '{}'::TEXT[],
    startup_stages TEXT,
    email_alerts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 30. Create fj_funded_startups Table
CREATE TABLE IF NOT EXISTS public.fj_funded_startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_name TEXT NOT NULL,
    funding_stage TEXT NOT NULL,
    funding_amount TEXT NOT NULL,
    funding_date DATE NOT NULL,
    website TEXT,
    location TEXT NOT NULL,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 31. Create fj_startup_jobs Table
CREATE TABLE IF NOT EXISTS public.fj_startup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id UUID REFERENCES public.fj_funded_startups(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    location TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 32. Create fj_notifications Table
CREATE TABLE IF NOT EXISTS public.fj_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.fj_funded_startups(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 33. Create fj_processed_articles Table
CREATE TABLE IF NOT EXISTS public.fj_processed_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url TEXT UNIQUE NOT NULL,
    title TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 34. Enable Row Level Security (RLS)
ALTER TABLE public.fj_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fj_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fj_funded_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fj_startup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fj_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fj_processed_articles ENABLE ROW LEVEL SECURITY;

-- 35. Create Policies for fj_profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_profiles' AND policyname = 'fj_policy_select_own_profile'
    ) THEN
        CREATE POLICY fj_policy_select_own_profile ON public.fj_profiles
            FOR SELECT USING (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_profiles' AND policyname = 'fj_policy_insert_own_profile'
    ) THEN
        CREATE POLICY fj_policy_insert_own_profile ON public.fj_profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_profiles' AND policyname = 'fj_policy_update_own_profile'
    ) THEN
        CREATE POLICY fj_policy_update_own_profile ON public.fj_profiles
            FOR UPDATE USING (auth.uid() = id);
    END IF;
END
$$;

-- 36. Create Policies for fj_preferences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_preferences' AND policyname = 'fj_policy_select_own_preferences'
    ) THEN
        CREATE POLICY fj_policy_select_own_preferences ON public.fj_preferences
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_preferences' AND policyname = 'fj_policy_insert_own_preferences'
    ) THEN
        CREATE POLICY fj_policy_insert_own_preferences ON public.fj_preferences
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_preferences' AND policyname = 'fj_policy_update_own_preferences'
    ) THEN
        CREATE POLICY fj_policy_update_own_preferences ON public.fj_preferences
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 37. Create Policies for fj_funded_startups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_funded_startups' AND policyname = 'fj_policy_select_funded_startups'
    ) THEN
        CREATE POLICY fj_policy_select_funded_startups ON public.fj_funded_startups
            FOR SELECT USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_funded_startups' AND policyname = 'fj_policy_insert_funded_startups'
    ) THEN
        CREATE POLICY fj_policy_insert_funded_startups ON public.fj_funded_startups
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 38. Create Policies for fj_startup_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_startup_jobs' AND policyname = 'fj_policy_select_startup_jobs'
    ) THEN
        CREATE POLICY fj_policy_select_startup_jobs ON public.fj_startup_jobs
            FOR SELECT USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_startup_jobs' AND policyname = 'fj_policy_insert_startup_jobs'
    ) THEN
        CREATE POLICY fj_policy_insert_startup_jobs ON public.fj_startup_jobs
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 39. Create Policies for fj_notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_notifications' AND policyname = 'fj_policy_select_own_notifications'
    ) THEN
        CREATE POLICY fj_policy_select_own_notifications ON public.fj_notifications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_notifications' AND policyname = 'fj_policy_insert_notifications'
    ) THEN
        CREATE POLICY fj_policy_insert_notifications ON public.fj_notifications
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 40. Create Policies for fj_processed_articles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_processed_articles' AND policyname = 'fj_policy_select_processed_articles'
    ) THEN
        CREATE POLICY fj_policy_select_processed_articles ON public.fj_processed_articles
            FOR SELECT USING (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fj_processed_articles' AND policyname = 'fj_policy_insert_processed_articles'
    ) THEN
        CREATE POLICY fj_policy_insert_processed_articles ON public.fj_processed_articles
            FOR INSERT WITH CHECK (true);
    END IF;
END
$$;

-- 41. Create Trigger Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.fj_handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp update triggers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'fj_trigger_update_profile_timestamp'
    ) THEN
        CREATE TRIGGER fj_trigger_update_profile_timestamp
            BEFORE UPDATE ON public.fj_profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.fj_handle_update_timestamp();
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'fj_trigger_update_preferences_timestamp'
    ) THEN
        CREATE TRIGGER fj_trigger_update_preferences_timestamp
            BEFORE UPDATE ON public.fj_preferences
            FOR EACH ROW
            EXECUTE FUNCTION public.fj_handle_update_timestamp();
    END IF;
END
$$;

-- 42. Auto-confirm new signups to bypass email verification requirement during testing
CREATE OR REPLACE FUNCTION public.fj_handle_new_user_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = now(),
        confirmed_at = now()
    WHERE id = new.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'fj_trigger_on_auth_user_created_confirm'
    ) THEN
        CREATE TRIGGER fj_trigger_on_auth_user_created_confirm
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.fj_handle_new_user_confirmation();
    END IF;
END
$$;



