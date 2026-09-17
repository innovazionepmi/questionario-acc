import "server-only";
import { getSupabaseServerClient } from "../supabase/server";
import type { CoverageEntry, Outputs, Session, Turn } from "../types";

export async function getSessionByToken(token: string): Promise<Session | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  return (data as Session | null) ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<Session, "status" | "started_at" | "last_activity_at" | "turn_count">>
): Promise<Session> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Session;
}

export async function getTurns(sessionId: string): Promise<Turn[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_number", { ascending: true });

  if (error) throw error;
  return (data as Turn[]) ?? [];
}

export async function appendTurn(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Turn> {
  const supabase = getSupabaseServerClient();

  const { data: lastTurn } = await supabase
    .from("turns")
    .select("turn_number")
    .eq("session_id", sessionId)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = ((lastTurn as { turn_number: number } | null)?.turn_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("turns")
    .insert({ session_id: sessionId, turn_number: nextNumber, role, content })
    .select("*")
    .single();

  if (error) throw error;
  return data as Turn;
}

export async function getCoverage(sessionId: string): Promise<CoverageEntry[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("coverage_state")
    .select("objective_id, status, extracted_content, updated_at")
    .eq("session_id", sessionId);

  if (error) throw error;
  return (data as CoverageEntry[]) ?? [];
}

export async function upsertCoverage(
  sessionId: string,
  updates: { objective_id: number; status: CoverageEntry["status"]; extracted_content: string }[]
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const rows = updates.map((u) => ({
    session_id: sessionId,
    objective_id: u.objective_id,
    status: u.status,
    extracted_content: u.extracted_content || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("coverage_state")
    .upsert(rows, { onConflict: "session_id,objective_id" });

  if (error) throw error;
}

export async function saveOutputs(
  sessionId: string,
  recapCliente: string,
  briefInterno: Outputs["brief_interno"]
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("outputs").upsert(
    {
      session_id: sessionId,
      recap_cliente: recapCliente,
      brief_interno: briefInterno,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );

  if (error) throw error;
}

export async function getOutputs(sessionId: string): Promise<Outputs | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("outputs")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as Outputs | null) ?? null;
}
