import { CenteredScreen, Wordmark } from "../layout/CenteredScreen";

export function NotFoundScreen() {
  return (
    <CenteredScreen>
      <Wordmark />
      <h1 className="mb-3 font-serif text-2xl font-semibold">Link non valido</h1>
      <p className="text-navy/80">
        Questo link non corrisponde a nessuna sessione attiva. Controlla di aver copiato
        l&apos;indirizzo per intero dall&apos;email che hai ricevuto, oppure scrivi a chi ti ha
        inviato il link per riceverne uno nuovo.
      </p>
    </CenteredScreen>
  );
}
