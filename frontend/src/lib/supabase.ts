import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TEMP: expose the client for manual Realtime/RLS verification in the
// browser console (e.g. `await window.supabase.channel(...)`). Remove once
// the Realtime migration in supabase/migrations has been verified.
if (typeof window !== 'undefined') {
    (window as unknown as { supabase: typeof supabase }).supabase = supabase;
}