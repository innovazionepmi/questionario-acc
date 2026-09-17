export function RecapScreen({ recapText, bookingUrl }: { recapText: string; bookingUrl: string }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-navy/10 bg-white/60 p-8 shadow-sm">
        <p className="mb-6 font-serif text-sm font-semibold tracking-wide text-gold uppercase">
          InnovazionePMI
        </p>
        <h1 className="mb-4 font-serif text-2xl font-semibold">Ecco cosa ho capito</h1>
        <div className="space-y-4 whitespace-pre-wrap text-navy/90 leading-relaxed">
          {recapText}
        </div>
        <a
          href={bookingUrl}
          className="mt-8 inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 font-medium text-ivory transition hover:bg-navy-light"
        >
          Prenota la call gratuita
        </a>
      </div>
    </div>
  );
}
