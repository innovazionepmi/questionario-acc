import { z } from "zod";
import { getAnthropicClient, getSynthesisModel } from "../anthropic/client";
import { getObjective, OBJECTIVES } from "./objectives";
import type { BriefInterno, ChatMessage, CoverageEntry } from "../types";

const SYNTHESIS_TOOL_NAME = "produce_synthesis";

const synthesisSchema = z.object({
  recap_cliente: z.string(),
  brief_interno: z.object({
    dimensioni: z.object({
      processi: z.string(),
      tecnologia: z.string(),
      dati: z.string(),
      persone_competenze: z.string(),
      governance_cultura: z.string(),
    }),
    obiettivi_non_coperti: z.array(
      z.object({ objective_id: z.number().int(), motivo: z.string() })
    ),
    note_libere: z.array(z.string()),
  }),
});

const SYSTEM_PROMPT = `Sei l'assistente di InnovazionePMI. L'intervista con questa PMI italiana è
conclusa: ora devi produrre due output a partire dalla conversazione completa.

1) recap_cliente: quello che l'utente vedrà a schermo, PRIMA di prenotare la call gratuita.
   Deve funzionare come uno specchio — "ecco cosa ho capito della tua situazione" — mai come
   un'anteprima di analisi o un mini-report con raccomandazioni. Nessun punteggio, nessuna
   diagnosi, nessun numero stimato: quelli arrivano solo nella call. Tono che dà valore
   percepito ("mi ha ascoltato davvero") senza cannibalizzare la consulenza. Pochi paragrafi,
   leggibile in 30 secondi. Scritto in italiano, rivolto direttamente alla persona (tu).

2) brief_interno: per uso esclusivamente interno di Emilio (il consulente), MAI mostrato
   all'utente. Sintesi per le 5 dimensioni (processi, tecnologia, dati, persone_competenze,
   governance_cultura) con evidenze testuali concrete raccolte durante l'intervista — non
   punteggi numerici automatici, quelli li assegna Emilio in call. Elenca gli obiettivi
   rimasti scoperti o parziali con una breve motivazione, così Emilio sa cosa chiedere lui
   stesso. Nelle note_libere segnala eventuali campanelli degni di nota (urgenza percepita,
   obiezioni implicite, livello di readiness culturale) come osservazioni testuali libere,
   mai come punteggi inventati. Se dalla conversazione risulta la preferenza della persona su
   come essere ricontattata (telefonicamente vs via email), riportala SEMPRE come prima voce
   di note_libere, in modo esplicito e riconoscibile (es. "Preferenza di contatto: ...").

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

export async function generateSynthesis(
  conversation: ChatMessage[],
  coverage: CoverageEntry[],
  lead: { firstName: string | null; company: string | null }
): Promise<{ recapCliente: string; briefInterno: BriefInterno }> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: getSynthesisModel(),
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: SYNTHESIS_TOOL_NAME,
        description: "Registra il recap cliente e il brief interno finali dell'intervista.",
        input_schema: {
          type: "object",
          properties: {
            recap_cliente: { type: "string" },
            brief_interno: {
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
          required: ["recap_cliente", "brief_interno"],
        },
      },
    ],
    tool_choice: { type: "tool", name: SYNTHESIS_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Persona intervistata: ${lead.firstName ?? "sconosciuto"}, azienda: ${lead.company ?? "sconosciuta"}.

Stato di copertura finale:
${coverageSummary(coverage)}

Conversazione completa:
${transcript(conversation)}

Genera recap_cliente e brief_interno.`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Il modello non ha restituito lo strumento di sintesi atteso");
  }

  const parsed = synthesisSchema.parse(toolUse.input);

  // Verifica difensiva: gli objective_id referenziati devono esistere nel pool.
  for (const item of parsed.brief_interno.obiettivi_non_coperti) {
    getObjective(item.objective_id);
  }

  return { recapCliente: parsed.recap_cliente, briefInterno: parsed.brief_interno };
}
