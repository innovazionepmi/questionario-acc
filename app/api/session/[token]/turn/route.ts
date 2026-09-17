import { NextResponse } from "next/server";
import {
  isSessionComplete,
  shouldForceClosingQuestion,
} from "@/lib/engine/coverage";
import { extractCoverage } from "@/lib/engine/extraction";
import {
  generateForcedClosingQuestion,
  generateNextQuestion,
} from "@/lib/engine/nextQuestion";
import { generateSynthesis } from "@/lib/engine/synthesis";
import { sendCompletionWebhook, type CompletionOutcome } from "@/lib/n8n/webhook";
import {
  appendTurn,
  getCoverage,
  getSessionByToken,
  getTurns,
  saveOutputs,
  updateSession,
  upsertCoverage,
} from "@/lib/session/repository";
import { isExpired } from "@/lib/session/state";
import type { ChatMessage, CoverageEntry } from "@/lib/types";

// Questa route esegue fino a due chiamate LLM in sequenza (estrazione +
// prossima domanda, oppure estrazione + sintesi con Opus al completamento):
// il timeout di default di Vercel può essere troppo stretto, specialmente
// per la sintesi finale su conversazioni lunghe.
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const session = await getSessionByToken(token);
  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (session.status !== "in_corso") {
    return NextResponse.json({ error: "session_not_active", status: session.status }, { status: 409 });
  }

  const now = new Date();
  if (session.started_at && isExpired(session.started_at, now)) {
    const expiredSession = await updateSession(session.id, { status: "scaduta" });
    return NextResponse.json({ session: expiredSession, error: "session_expired" }, { status: 410 });
  }

  await appendTurn(session.id, "user", message);
  const newTurnCount = session.turn_count + 1;
  await updateSession(session.id, { turn_count: newTurnCount, last_activity_at: now.toISOString() });

  try {
    const turns = await getTurns(session.id);
    const conversation: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    const previousCoverage = await getCoverage(session.id);

    const extracted = await extractCoverage(conversation, previousCoverage);
    await upsertCoverage(session.id, extracted);

    const newCoverage: CoverageEntry[] = extracted.map((e) => ({
      objective_id: e.objective_id,
      status: e.status,
      extracted_content: e.extracted_content,
      updated_at: now.toISOString(),
    }));

    const complete = isSessionComplete(newCoverage, newTurnCount);

    if (!complete) {
      const forceClosing = shouldForceClosingQuestion(newCoverage, newTurnCount);
      const assistantMessage = forceClosing
        ? await generateForcedClosingQuestion(conversation, newCoverage)
        : await generateNextQuestion(conversation, newCoverage, {
            firstName: session.first_name,
            company: session.company,
          });

      await appendTurn(session.id, "assistant", assistantMessage);

      return NextResponse.json({ status: "in_corso", assistantMessage });
    }

    const outcome: CompletionOutcome = newTurnCount >= 18 ? "abbandonata_forzata" : "completata";

    const { recapCliente, briefInterno } = await generateSynthesis(conversation, newCoverage, {
      firstName: session.first_name,
      company: session.company,
    });

    await saveOutputs(session.id, recapCliente, briefInterno);
    const finalSession = await updateSession(session.id, { status: "completata" });

    await sendCompletionWebhook({
      token: finalSession.token,
      hubspot_contact_id: finalSession.hubspot_contact_id,
      email: finalSession.email,
      recap_cliente: recapCliente,
      brief_interno: briefInterno,
      stato_finale: outcome,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      status: "completata",
      recapCliente,
      session: finalSession,
    });
  } catch (err) {
    // Diagnostica temporanea: logga e ritorna il dettaglio dell'errore reale
    // (invece di un 500 muto) per isolare la causa senza dover accedere ai
    // log di Vercel — l'app è ancora in fase di test pre-lancio con un solo
    // utente (lo sviluppatore stesso), quindi il dettaglio non è sensibile.
    const detail = err instanceof Error ? err.message : String(err);
    const zodIssues = err && typeof err === "object" && "issues" in err ? err.issues : undefined;
    console.error(`Errore nel turno per sessione ${session.id} (turn_count=${newTurnCount}):`, err);
    return NextResponse.json(
      { error: "internal_error", detail, zodIssues },
      { status: 500 }
    );
  }
}
