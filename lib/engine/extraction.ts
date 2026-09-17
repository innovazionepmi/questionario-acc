import { z } from "zod";
import { getAnthropicClient, getTurnModel } from "../anthropic/client";
import { OBJECTIVES } from "./objectives";
import type { ChatMessage, CoverageEntry, ObjectiveStatus } from "../types";

const EXTRACTION_TOOL_NAME = "update_coverage";
const OBJECTIVE_COUNT = OBJECTIVES.length;

const coverageUpdateSchema = z.object({
  objectives: z
    .array(
      z.object({
        objective_id: z.number().int().min(1).max(OBJECTIVE_COUNT),
        status: z.enum(["scoperto", "parziale", "coperto"]),
        extracted_content: z.string(),
      })
    )
    .min(1),
});

const SYSTEM_PROMPT = `Sei un analista che valuta, dopo ogni scambio di un'intervista a una PMI italiana,
quali dei ${OBJECTIVE_COUNT} obiettivi informativi elencati sono stati coperti dalla conversazione fin qui.

Sii severo: marca "coperto" solo se l'informazione raccolta è realmente utilizzabile e
specifica (non un accenno generico). Marca "parziale" se l'argomento è stato toccato ma
manca dettaglio concreto. Marca "scoperto" se non è stato affrontato o la risposta è stata
troppo vaga per essere utile.

Valuta TUTTI e ${OBJECTIVE_COUNT} gli obiettivi ad ogni chiamata, sulla base dell'intera conversazione, non
solo dell'ultimo messaggio. Se un obiettivo era già coperto in un turno precedente, mantieni
lo stato invariato a meno che la conversazione non lo contraddica.

Rispondi esclusivamente tramite lo strumento fornito.`;

function objectivesReference() {
  return OBJECTIVES.map(
    (o) => `${o.id}. [${o.dimension}] ${o.label} — es. "${o.anchorQuestion}"`
  ).join("\n");
}

export async function extractCoverage(
  conversation: ChatMessage[],
  currentCoverage: CoverageEntry[]
): Promise<{ objective_id: number; status: ObjectiveStatus; extracted_content: string }[]> {
  const client = getAnthropicClient();

  const currentStateSummary = currentCoverage.length
    ? currentCoverage
        .map((c) => `- Obiettivo ${c.objective_id}: ${c.status}${c.extracted_content ? ` (${c.extracted_content})` : ""}`)
        .join("\n")
    : "Nessun obiettivo ancora valutato.";

  const transcript = conversation
    .map((m) => `${m.role === "user" ? "Utente" : "Assistente"}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: getTurnModel(),
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: EXTRACTION_TOOL_NAME,
        description: `Registra lo stato di copertura aggiornato per ciascuno dei ${OBJECTIVE_COUNT} obiettivi informativi.`,
        input_schema: {
          type: "object",
          properties: {
            objectives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objective_id: { type: "integer", minimum: 1, maximum: OBJECTIVE_COUNT },
                  status: { type: "string", enum: ["scoperto", "parziale", "coperto"] },
                  extracted_content: {
                    type: "string",
                    description: "Sintesi di quanto raccolto per questo obiettivo; stringa vuota se scoperto.",
                  },
                },
                required: ["objective_id", "status", "extracted_content"],
              },
            },
          },
          required: ["objectives"],
        },
      },
    ],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Obiettivi informativi (riferimento):\n${objectivesReference()}\n\nStato di copertura precedente:\n${currentStateSummary}\n\nConversazione:\n${transcript}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Il modello non ha restituito lo strumento di estrazione atteso");
  }

  const parsed = coverageUpdateSchema.parse(toolUse.input);
  return parsed.objectives;
}
