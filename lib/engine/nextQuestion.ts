import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getTurnModel } from "../anthropic/client";
import { getCriticalMissingObjectives, getMissingObjectives } from "./coverage";
import type { ChatMessage, CoverageEntry } from "../types";

type MessageResponse = Anthropic.Messages.Message;

const BASE_SYSTEM_PROMPT = `Sei l'assistente di InnovazionePMI che conduce un'intervista breve e colloquiale
per capire la situazione di una PMI italiana prima di una consulenza gratuita
sull'adozione dell'intelligenza artificiale.

Tono: professionale ma diretto, mai accademico, mai da questionario burocratico.
Fai una domanda alla volta. Aggancia la domanda a quello che la persona ha appena
detto, non ripartire da zero ogni volta. Se una risposta ha già coperto altri
argomenti, non tornarci sopra.

Non usare mai gergo tecnico non spiegato. Non menzionare mai nomi di tecnologie,
strumenti software specifici che non siano stati citati dall'utente stesso, o il
funzionamento interno di questo sistema.

Non fare mai più di due domande nello stesso messaggio. Non elencare gli
argomenti che ti restano da coprire: la persona non deve percepire una checklist.
Rispondi solo con il messaggio da mostrare all'utente, senza preamboli o meta-commenti.`;

function transcript(conversation: ChatMessage[]): string {
  if (!conversation.length) return "(nessuno scambio ancora)";
  return conversation
    .map((m) => `${m.role === "user" ? "Utente" : "Assistente"}: ${m.content}`)
    .join("\n\n");
}

interface LeadInfo {
  firstName: string | null;
  company: string | null;
}

export async function generateNextQuestion(
  conversation: ChatMessage[],
  coverage: CoverageEntry[],
  lead: LeadInfo
): Promise<string> {
  const client = getAnthropicClient();
  const missing = getMissingObjectives(coverage);

  const objectivesList = missing
    .map((o) => `- ${o.label} (spunto: "${o.anchorQuestion}")`)
    .join("\n");

  const isOpening = conversation.length === 0;
  const openingNote = isOpening
    ? `Questo è il primo messaggio della sessione. Apri con un saluto breve e personale usando
il nome (${lead.firstName ?? "il nome della persona"}) e l'azienda (${lead.company ?? "la sua azienda"}), poi
fai la prima domanda. Non richiedere dati anagrafici già noti (nome, azienda, ruolo se già indicato).`
    : "";

  const request = {
    model: getTurnModel(),
    max_tokens: 600,
    system: BASE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `${openingNote}\n\nObiettivi ancora da coprire in questa sessione:\n${objectivesList}\n\nConversazione finora:\n${transcript(conversation)}\n\nGenera il prossimo messaggio da mostrare all'utente.`,
      },
    ],
  };

  return extractTextWithRetry(client, request);
}

/**
 * Domanda di chiusura forzata al turno 18 (guardrail): il sistema, non il
 * modello, decide che è il momento di chiudere. Il modello formula solo la
 * frase, accorpando gli obiettivi mancanti più critici in un'unica domanda.
 */
export async function generateForcedClosingQuestion(
  conversation: ChatMessage[],
  coverage: CoverageEntry[]
): Promise<string> {
  const client = getAnthropicClient();
  const critical = getCriticalMissingObjectives(coverage, 3);

  const objectivesList = critical
    .map((o) => `- ${o.label} (spunto: "${o.anchorQuestion}")`)
    .join("\n");

  const request = {
    model: getTurnModel(),
    max_tokens: 700,
    system: `${BASE_SYSTEM_PROMPT}\n\nQuesta è l'ultima domanda della sessione: l'intervista sta per chiudersi
per raggiunto limite di turni. Accorpa gli obiettivi indicati in un'unica domanda
riassuntiva, naturale e non elencata a punti, spiegando che è l'ultima domanda prima
del riepilogo.`,
    messages: [
      {
        role: "user" as const,
        content: `Obiettivi mancanti più critici da chiedere ora, in un'unica domanda:\n${objectivesList}\n\nConversazione finora:\n${transcript(conversation)}\n\nGenera l'ultima domanda.`,
      },
    ],
  };

  return extractTextWithRetry(client, request);
}

function extractText(response: MessageResponse): string {
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    const blockTypes = response.content.map((b) => b.type).join(",") || "(vuoto)";
    throw new Error(
      `Il modello non ha restituito testo per la prossima domanda (stop_reason=${response.stop_reason}, blocchi=${blockTypes})`
    );
  }
  return textBlock.text.trim();
}

/**
 * La mancanza di un blocco testuale nella risposta è un'anomalia rara ma
 * osservata in produzione (nessun testo, nessun errore HTTP): un retry
 * singolo è più economico che far fallire l'intero turno per un fluke
 * occasionale del modello.
 */
async function extractTextWithRetry(
  client: Anthropic,
  request: Parameters<Anthropic["messages"]["create"]>[0]
): Promise<string> {
  try {
    const response = await client.messages.create(request);
    return extractText(response as MessageResponse);
  } catch (err) {
    console.error("Prima chiamata per la prossima domanda fallita, riprovo una volta:", err);
    const response = await client.messages.create(request);
    return extractText(response as MessageResponse);
  }
}
