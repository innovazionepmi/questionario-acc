import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_VERSION = "2023-06-01";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY mancante nelle variabili d'ambiente");
  }

  client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-version": ANTHROPIC_VERSION },
  });

  return client;
}

export function getTurnModel(): string {
  return process.env.ANTHROPIC_MODEL_TURN ?? "claude-sonnet-5";
}

export function getSynthesisModel(): string {
  return process.env.ANTHROPIC_MODEL_SYNTHESIS ?? "claude-opus-5";
}
