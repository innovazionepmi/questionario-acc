import "server-only";
import type { BriefInterno } from "../types";

export type CompletionOutcome = "completata" | "abbandonata_forzata";

interface CompletionWebhookPayload {
  token: string;
  hubspot_contact_id: string | null;
  email: string | null;
  recap_cliente: string;
  brief_interno: BriefInterno;
  stato_finale: CompletionOutcome;
  timestamp: string;
}

/**
 * Invia il webhook di completamento al flusso n8n che aggiorna HubSpot.
 * Non deve mai bloccare la visualizzazione del recap già generato: eventuali
 * errori vengono loggati e basta, il chiamante non deve propagarli.
 */
export async function sendCompletionWebhook(payload: CompletionWebhookPayload): Promise<void> {
  const url = process.env.N8N_COMPLETION_WEBHOOK_URL;

  if (!url) {
    console.warn("N8N_COMPLETION_WEBHOOK_URL non impostata: webhook di completamento saltato", payload);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Webhook di completamento n8n fallito (status ${response.status}) per token ${payload.token}`
      );
    }
  } catch (err) {
    console.error("Errore di rete inviando il webhook di completamento n8n", err);
  }
}
