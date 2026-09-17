import { CenteredScreen, Wordmark } from "../layout/CenteredScreen";

export function ExpiredScreen({ variant }: { variant: "scaduta" | "abbandonata" }) {
  const message =
    variant === "scaduta"
      ? "Il link che hai aperto è scaduto: era valido per due ore dal primo accesso. Nessun problema — scrivi a chi ti ha inviato il link e te ne verrà generato uno nuovo."
      : "Questa sessione risulta chiusa. Se pensi si tratti di un errore, scrivi a chi ti ha inviato il link.";

  return (
    <CenteredScreen>
      <Wordmark />
      <h1 className="mb-3 font-serif text-2xl font-semibold">
        {variant === "scaduta" ? "Il link è scaduto" : "Sessione non disponibile"}
      </h1>
      <p className="text-navy/80">{message}</p>
    </CenteredScreen>
  );
}
