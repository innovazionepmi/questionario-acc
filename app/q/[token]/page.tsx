import { ChatClient } from "@/components/chat/ChatClient";
import { RecapScreen } from "@/components/recap/RecapScreen";
import { ExpiredScreen } from "@/components/session/ExpiredScreen";
import { NotFoundScreen } from "@/components/session/NotFoundScreen";
import { buildBookingUrl } from "@/lib/session/booking";
import { loadOrInitializeSession } from "@/lib/session/access";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await loadOrInitializeSession(token);

  if (result.kind === "not_found") {
    return <NotFoundScreen />;
  }

  if (result.kind === "expired") {
    return <ExpiredScreen variant="scaduta" />;
  }

  if (result.kind === "abandoned") {
    return <ExpiredScreen variant="abbandonata" />;
  }

  const bookingUrl = buildBookingUrl(result.session);

  if (result.kind === "completed") {
    const recapText = result.outputs?.recap_cliente ?? "";
    return <RecapScreen recapText={recapText} bookingUrl={bookingUrl} />;
  }

  return (
    <ChatClient
      token={token}
      initialTurns={result.turns}
      initialTurnCount={result.session.turn_count}
      bookingUrl={bookingUrl}
    />
  );
}
