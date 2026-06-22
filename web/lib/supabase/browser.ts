import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const STORAGE_BUCKET = "client-assets";

let cached: SupabaseClient | null = null;

/**
 * Browser-side Supabase client (anon key). Usado apenas para upload direto
 * de arquivos ao Storage via signed upload URL — o token da URL assinada é
 * quem autoriza a escrita, então não dependemos de sessão/RLS.
 */
export function supabaseBrowser(): SupabaseClient {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!cached) {
    cached = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
