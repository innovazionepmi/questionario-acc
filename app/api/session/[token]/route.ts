import { NextResponse } from "next/server";
import { loadOrInitializeSession } from "@/lib/session/access";

// Al primo accesso genera la domanda di apertura con una chiamata LLM: il
// timeout di default di Vercel può essere troppo stretto in caso di latenza.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await loadOrInitializeSession(token);

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (result.kind === "expired" || result.kind === "abandoned") {
    return NextResponse.json({ session: result.session, turns: [], outputs: null });
  }

  if (result.kind === "completed") {
    return NextResponse.json({ session: result.session, turns: result.turns, outputs: result.outputs });
  }

  return NextResponse.json({ session: result.session, turns: result.turns, outputs: null });
}
