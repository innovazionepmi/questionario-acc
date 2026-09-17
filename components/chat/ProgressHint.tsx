const MAX_TURNS_HINT = 18;

/** Barra di avanzamento soffice, senza numeri né elenchi: solo una sensazione di progresso. */
export function ProgressHint({ turnCount }: { turnCount: number }) {
  const pct = Math.min(100, Math.round((turnCount / MAX_TURNS_HINT) * 100));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-navy/10">
      <div
        className="h-full rounded-full bg-gold transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
