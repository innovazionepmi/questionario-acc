import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Nessun tipo Database generato: il progetto Supabase non esiste ancora in
// questa fase. Una volta applicata la migrazione (supabase/migrations/0001_init.sql)
// su un progetto reale, si può rigenerare con `supabase gen types typescript`
// e tipizzare il client con `createClient<Database>(...)`. Nel frattempo la
// sicurezza dei tipi è garantita ai bordi di lib/session/repository.ts.
let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti nelle variabili d'ambiente"
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return client;
}
