"use client";

import { useState } from "react";
import { RecapScreen } from "../recap/RecapScreen";
import { ExpiredScreen } from "../session/ExpiredScreen";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { ProgressHint } from "./ProgressHint";
import type { Turn } from "@/lib/types";

interface DisplayMessage {
  key: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatClient({
  token,
  initialTurns,
  initialTurnCount,
  bookingUrl,
}: {
  token: string;
  initialTurns: Turn[];
  initialTurnCount: number;
  bookingUrl: string;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialTurns.map((t) => ({ key: t.id, role: t.role, content: t.content }))
  );
  const [turnCount, setTurnCount] = useState(initialTurnCount);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function handleSend(message: string) {
    setError(null);
    setMessages((prev) => [...prev, { key: `local-${Date.now()}`, role: "user", content: message }]);
    setSending(true);

    try {
      const res = await fetch(`/api/session/${token}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (res.status === 410) {
        setExpired(true);
        return;
      }

      if (!res.ok) {
        setError("C'è stato un problema nell'invio. Riprova tra un momento.");
        return;
      }

      const data = await res.json();
      setTurnCount((prev) => prev + 1);

      if (data.status === "completata") {
        setRecap(data.recapCliente as string);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { key: `assistant-${Date.now()}`, role: "assistant", content: data.assistantMessage as string },
      ]);
    } catch {
      setError("C'è stato un problema di connessione. Riprova tra un momento.");
    } finally {
      setSending(false);
    }
  }

  if (expired) return <ExpiredScreen variant="scaduta" />;
  if (recap) return <RecapScreen recapText={recap} bookingUrl={bookingUrl} />;

  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-2xl flex-col">
      <div className="p-4">
        <ProgressHint turnCount={turnCount} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {messages.map((m) => (
          <MessageBubble key={m.key} role={m.role} content={m.content} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-navy/10 bg-white px-4 py-3 text-navy/40">
              …
            </div>
          </div>
        )}
      </div>
      {error && <p className="px-4 pb-2 text-sm text-red-700">{error}</p>}
      <Composer disabled={sending} onSend={handleSend} />
    </div>
  );
}
