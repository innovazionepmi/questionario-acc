import { after, NextResponse } from "next/server";
import {
  isSessionComplete,
  MAX_USER_TURNS,
  shouldForceClosingQuestion,
} from "@/lib/engine/coverage";
import { extractCoverage } from "@/lib/engine/extraction";
import {
  generateForcedClosingQuestion,
  generateNextQuestion,
} from "@/lib/engine/nextQuestion";
import {
  failedBrief,
  generateBrief,
  generateRecap,
  pendingBrief,
} from "@/lib/engine/synthesis";
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

// Il turno finale genera il recap con Opus (~10-15s) in modo sincrono; il
// brief interno (~25-35s) e il webhook girano dopo la risposta tramite
// after(), che condivide questo stesso limite di durata.
export const maxDuration = 60;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`${label}: primo tentativo fallito, riprovo una volta`, err);
    return fn();
  }
}

function toCoverageEntries(
  extracted: { objective_id: number; status: CoverageEntry["status"]; extracted_content: string }[]
): CoverageEntry[] {
  const updatedAt = new Date().toISOString();
  return extracted.map((e) => ({
    objective_id: e.objective_id,
    status: e.status,
    extracted_content: e.extracted_content,
    updated_at: updatedAt,
  }));
}

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

  const newTurnCount = session.turn_count + 1;

  try {
    // Nulla viene salvato (messaggio utente, contatore) finché l'elaborazione
    // non riesce: così un tentativo fallito o andato in timeout può essere
    // ripetuto senza duplicare messaggi né consumare turni.
    const existingTurns = await getTurns(session.id);
    const conversation: ChatMessage[] = [
      ...existingTurns.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: message },
    ];
    const previousCoverage = await getCoverage(session.id);

    // Oltre il limite di turni la chiusura è comunque forzata: l'estrazione
    // sincrona sarebbe tempo perso (viene fatta in background per il brief).
    const forced = newTurnCount >= MAX_USER_TURNS;
    let coverage: CoverageEntry[] = previousCoverage;

    if (!forced) {
      const extracted = await extractCoverage(conversation, previousCoverage);
      await upsertCoverage(session.id, extracted);
      coverage = toCoverageEntries(extracted);
    }

    const lead = { firstName: session.first_name, company: session.company };

    if (!isSessionComplete(coverage, newTurnCount)) {
      const assistantMessage = shouldForceClosingQuestion(coverage, newTurnCount)
        ? await generateForcedClosingQuestion(conversation, coverage)
        : await generateNextQuestion(conversation, coverage, lead);

      await appendTurn(session.id, "user", message);
      await appendTurn(session.id, "assistant", assistantMessage);
      await updateSession(session.id, {
        turn_count: newTurnCount,
        last_activity_at: now.toISOString(),
      });

      return NextResponse.json({ status: "in_corso", assistantMessage });
    }

    const outcome: CompletionOutcome = forced ? "abbandonata_forzata" : "completata";

    // Il brief parte subito in parallelo al recap, ma la risposta all'utente
    // non lo aspetta: viene atteso dentro after().
    const briefTask = (async () => {
      let briefCoverage = coverage;
      if (forced) {
        try {
          const extracted = await extractCoverage(conversation, previousCoverage);
          await upsertCoverage(session.id, extracted);
          briefCoverage = toCoverageEntries(extracted);
        } catch (err) {
          console.error("Estrazione finale in background fallita, uso la copertura precedente", err);
        }
      }
      return withRetry("Brief interno", () => generateBrief(conversation, briefCoverage, lead));
    })().then(
      (brief) => ({ ok: true as const, brief }),
      (error: unknown) => ({ ok: false as const, error })
    );

    const recapCliente = await withRetry("Recap cliente", () => generateRecap(conversation, lead));

    await appendTurn(session.id, "user", message);
    await saveOutputs(session.id, recapCliente, pendingBrief());
    const finalSession = await updateSession(session.id, {
      status: "completata",
      turn_count: newTurnCount,
      last_activity_at: now.toISOString(),
    });

    after(async () => {
      const result = await briefTask;
      let briefInterno = failedBrief();
      if (result.ok) {
        briefInterno = result.brief;
      } else {
        console.error(`Brief interno non generato per la sessione ${session.id}`, result.error);
      }

      try {
        await saveOutputs(session.id, recapCliente, briefInterno);
      } catch (err) {
        console.error(`Salvataggio del brief fallito per la sessione ${session.id}`, err);
      }

      await sendCompletionWebhook({
        token: finalSession.token,
        hubspot_contact_id: finalSession.hubspot_contact_id,
        email: finalSession.email,
        recap_cliente: recapCliente,
        brief_interno: briefInterno,
        stato_finale: outcome,
        timestamp: new Date().toISOString(),
      });
    });

    return NextResponse.json({
      status: "completata",
      recapCliente,
      session: finalSession,
    });
  } catch (err) {
    // Diagnostica temporanea: logga e ritorna il dettaglio dell'errore reale
    // (invece di un 500 muto) — l'app è ancora in fase di test pre-lancio con
    // un solo utente (lo sviluppatore stesso), quindi il dettaglio non è sensibile.
    const detail = err instanceof Error ? err.message : String(err);
    const zodIssues = err && typeof err === "object" && "issues" in err ? err.issues : undefined;
    console.error(`Errore nel turno per sessione ${session.id} (turno ${newTurnCount}):`, err);
    return NextResponse.json({ error: "internal_error", detail, zodIssues }, { status: 500 });
  }
}
