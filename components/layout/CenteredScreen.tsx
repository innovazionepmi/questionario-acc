import type { ReactNode } from "react";

export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-navy/10 bg-white/60 p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function Wordmark() {
  return (
    <p className="mb-6 font-serif text-sm font-semibold tracking-wide text-gold uppercase">
      InnovazionePMI
    </p>
  );
}
