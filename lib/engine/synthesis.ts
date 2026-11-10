import { z } from "zod";
import { getAnthropicClient, getSynthesisModel } from "../anthropic/client";
import { getObjective, OBJECTIVES } from "./objectives";
import type { BriefInterno, ChatMessage, CoverageEntry } from "../types";

const BRIEF_TOOL_NAME = "produce_brief";

const briefSchema = z.object({
  dimensioni: z.object({
    processi: z.string(),
    tecnologia: z.string(),
    dati: z.string(),
    persone_competenze: z.string(),
    governance_cultura: z.string(),
  }),
  obiettivi_non_coperti: z.array(z.object({ objective_id: z.number().int(), motivo: z.string() })),
  note_libere: z.array(z.string()),
});

const RECAP_SYSTEM_PROMPT = `Sei l'assistente di InnovazionePMI. L'intervista con questa PMI italiana è
conclusa: scrivi il recap che l'utente vedrà a schermo, PRIMA di prenotare la call gratuita.

Il recap ha DUE parti, in quest'ordine.

PARTE 1 — specchio: 2 paragrafi brevi (circa 120 parole in tutto) che restituiscono con
parole sue la situazione, il problema che gli pesa di più e il contesto (strumenti, persone,
modo di lavorare). Fedele a ciò che ha detto, senza inventare. Non aprire con "Ecco cosa ho
capito": la pagina ha già questo titolo, parti direttamente dal contenuto.

PARTE 2 — aree di intervento. Introdotta da una riga che dice "Dove potremmo intervenire:",
poi 2-3 aree, una per paragrafo breve (massimo 50 parole), ciascuna collegata a qualcosa che la persona ha
detto davvero. Per ogni area indica DOVE agire e PERCHÉ è la leva giusta per cambiare il
comportamento che ha descritto (es. "Il passaggio manuale tra X e Y: è lì che si perdono
informazioni e tempo"). Parti dalla più impattante. Queste aree sono spunti di direzione,
non un piano: NON proporre soluzioni tecniche dettagliate, NON nominare strumenti o
software, NON indicare costi, tempi, percentuali, punteggi o diagnosi di maturità. Il
"come" e il "quanto" si costruiscono insieme nella call: puoi dirlo in una frase finale.

Tono: dà valore percepito ("mi ha ascoltato davvero e sa dove guardare") senza
cannibalizzare la consulenza. Italiano, rivolto direttamente alla persona (tu), leggibile
in un minuto. Testo semplice: niente markdown, niente elenchi puntati o numerati, niente
grassetti o titoli.
Se dalla conversazione risulta come la persona preferisce essere ricontattata
(telefonicamente vs via email), chiudi con una frase che lo conferma.
Rispondi solo con il testo del recap.`;

const BRIEF_SYSTEM_PROMPT = `Sei l'assistente di InnovazionePMI. L'intervista con questa PMI italiana è
conclusa: produci il brief interno, per uso esclusivamente interno di Emilio (il consulente),
MAI mostrato all'utente.

Sintesi per le 5 dimensioni (processi, tecnologia, dati, persone_competenze,
governance_cultura) con evidenze testuali concrete raccolte durante l'intervista — non
punteggi numerici automatici, quelli li assegna Emilio in call. Sii conciso: massimo 3-4
frasi per dimensione. Elenca gli obiettivi rimasti scoperti o parziali con una breve
motivazione (una frase), così Emilio sa cosa chiedere lui stesso. Se la conversazione e lo
stato di copertura sono in contrasto, prevale la conversazione. Nelle note_libere segnala
eventuali campanelli degni di nota (urgenza percepita, obiezioni implicite, livello di
readiness culturale) come osservazioni testuali brevi, mai come punteggi inventati. Se dalla
conversazione risulta la preferenza della persona su come essere ricontattata (telefonicamente
vs via email), riportala SEMPRE come prima voce di note_libere, in modo esplicito e
riconoscibile (es. "Preferenza di contatto: ...").

Rispondi esclusivamente tramite lo strumento fornito.`;

function transcript(conversation: ChatMessage[]): string {
  return conversation
    .map((m) => `${m.role === "user" ? "Utente" : "Assistente"}: ${m.content}`)
    .join("\n\n");
}

function coverageSummary(coverage: CoverageEntry[]): string {
  return OBJECTIVES.map((o) => {
    const entry = coverage.find((c) => c.objective_id === o.id);
    const status = entry?.status ?? "scoperto";
    const content = entry?.extracted_content ? ` — ${entry.extracted_content}` : "";
    return `${o.id}. [${o.dimension}] ${o.label}: ${status}${content}`;
  }).join("\n");
}

interface LeadInfo {
  firstName: string | null;
  company: string | null;
}

function leadLine(lead: LeadInfo): string {
  return `Persona intervistata: ${lead.firstName ?? "sconosciuto"}, azienda: ${lead.company ?? "sconosciuta"}.`;
}

/** Recap per l'utente: è l'unica parte che il turno finale aspetta in modo sincrono. */
export async function generateRecap(conversation: ChatMessage[], lead: LeadInfo): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: getSynthesisModel(),
    max_tokens: 1800,
    system: RECAP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${leadLine(lead)}\n\nConversazione completa:\n${transcript(conversation)}\n\nScrivi il recap.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
    throw new Error(`Il modello non ha restituito il recap (stop_reason=${response.stop_reason})`);
  }
  return textBlock.text.trim();
}

/** Brief interno per il consulente: generato in background dopo la risposta all'utente. */
export async function generateBrief(
  conversation: ChatMessage[],
  coverage: CoverageEntry[],
  lead: LeadInfo
): Promise<BriefInterno> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: getSynthesisModel(),
    max_tokens: 3000,
    system: BRIEF_SYSTEM_PROMPT,
    tools: [
      {
        name: BRIEF_TOOL_NAME,
        description: "Registra il brief interno finale dell'intervista.",
        input_schema: {
          type: "object",
          properties: {
            dimensioni: {
              type: "object",
              properties: {
                processi: { type: "string" },
                tecnologia: { type: "string" },
                dati: { type: "string" },
                persone_competenze: { type: "string" },
                governance_cultura: { type: "string" },
              },
              required: ["processi", "tecnologia", "dati", "persone_competenze", "governance_cultura"],
            },
            obiettivi_non_coperti: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objective_id: { type: "integer" },
                  motivo: { type: "string" },
                },
                required: ["objective_id", "motivo"],
              },
            },
            note_libere: { type: "array", items: { type: "string" } },
          },
          required: ["dimensioni", "obiettivi_non_coperti", "note_libere"],
        },
      },
    ],
    tool_choice: { type: "tool", name: BRIEF_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `${leadLine(lead)}

Stato di copertura finale:
${coverageSummary(coverage)}

Conversazione completa:
${transcript(conversation)}

Genera il brief interno.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Il modello non ha restituito il brief atteso (stop_reason=${response.stop_reason})`);
  }

  const parsed = briefSchema.parse(toolUse.input);

  // Verifica difensiva: gli objective_id referenziati devono esistere nel pool.
  for (const item of parsed.obiettivi_non_coperti) {
    getObjective(item.objective_id);
  }

  return parsed;
}

function placeholderBrief(message: string): BriefInterno {
  return {
    dimensioni: {
      processi: message,
      tecnologia: message,
      dati: message,
      persone_competenze: message,
      governance_cultura: message,
    },
    obiettivi_non_coperti: [],
    note_libere: [message],
  };
}

/** Segnaposto salvato insieme al recap finché il brief vero non è pronto. */
export function pendingBrief(): BriefInterno {
  return placeholderBrief("Brief interno in elaborazione.");
}

/** Usato se la generazione in background fallisce: il lead non deve comunque andare perso. */
export function failedBrief(): BriefInterno {
  return placeholderBrief(
    "Brief interno NON generato per un errore tecnico: rileggere la trascrizione della sessione."
  );
}
