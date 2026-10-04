import { createClient } from "@supabase/supabase-js";

// Browser client. Only the publishable key belongs here; RLS decides what a signed-in
// cooperative member can read. Never put a secret or service_role key in this app.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
