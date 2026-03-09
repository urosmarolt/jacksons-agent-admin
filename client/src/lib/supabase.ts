import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  session_id: string;
  email: string;
  created_at: string;
  last_active: string;
  status: string;
}

export interface Message {
  id: number;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
  tool_calls: unknown | null;
  tool_results: unknown | null;
}

export interface Ticket {
  ticket_id: number;
  session_id: string;
  email: string;
  subject: string;
  status: string;
  created_at: string;
}
