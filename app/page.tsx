import { CenteredScreen, Wordmark } from "@/components/layout/CenteredScreen";

export default function Home() {
  return (
    <CenteredScreen>
      <Wordmark />
      <h1 className="mb-3 font-serif text-2xl font-semibold">Il tuo questionario</h1>
      <p className="text-navy/80">
        Questa pagina si apre solo tramite il link personale che hai ricevuto via email dopo
        aver richiesto l&apos;acceleratore per l&apos;adozione dell&apos;AI.
      </p>
    </CenteredScreen>
  );
}
