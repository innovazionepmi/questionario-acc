import "server-only";
import { generateNextQuestion } from "../engine/nextQuestion";
import type { Outputs, Session, Turn } from "../types";
import { appendTurn, getOutputs, getSessionByToken, getTurns, updateSession } from "./repository";
import { isExpired } from "./state";

export type SessionAccessResult =
  | { kind: "not_found" }
  | { kind: "expired"; session: Session }
  | { kind: "abandoned"; session: Session }
  | { kind: "completed"; session: Session; turns: Turn[]; outputs: Outputs | null }
  | { kind: "active"; session: Session; turns: Turn[] };

/**
 * Punto unico di ingresso per l'accesso a una sessione via token: valida
 * l'esistenza, gestisce started_at/scadenza al primo accesso, e genera la
 * domanda di apertura se la conversazione è ancora vuota. Usato sia dalla
 * route GET sia dal server component della pagina, per evitare una
 * self-fetch HTTP e una doppia generazione della domanda di apertura.
 */
export async function loadOrInitializeSession(token: string): Promise<SessionAccessResult> {
  const session = await getSessionByToken(token);
  if (!session) return { kind: "not_found" };

  const now = new Date();

  if (session.status === "completata") {
    const outputs = await getOutputs(session.id);
    return { kind: "completed", session, turns: await getTurns(session.id), outputs };
  }

  if (session.status === "abbandonata") {
    return { kind: "abandoned", session };
  }

  if (session.status === "scaduta") {
    return { kind: "expired", session };
  }

  if (session.status === "in_corso" && session.started_at && isExpired(session.started_at, now)) {
    const expiredSession = await updateSession(session.id, { status: "scaduta" });
    return { kind: "expired", session: expiredSession };
  }

  let activeSession = session;
  if (session.status === "non_iniziata") {
    activeSession = await updateSession(session.id, {
      status: "in_corso",
      started_at: now.toISOString(),
      last_activity_at: now.toISOString(),
    });
  } else {
    activeSession = await updateSession(session.id, { last_activity_at: now.toISOString() });
  }

  let turns = await getTurns(activeSession.id);

  if (turns.length === 0) {
    const opening = await generateNextQuestion([], [], {
      firstName: activeSession.first_name,
      company: activeSession.company,
    });
    await appendTurn(activeSession.id, "assistant", opening);
    turns = await getTurns(activeSession.id);
  }

  return { kind: "active", session: activeSession, turns };
}
