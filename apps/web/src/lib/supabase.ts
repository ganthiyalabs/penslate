import { createClient } from "@supabase/supabase-js";
import { env } from "@penslate/env/web";

export const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY,
);
