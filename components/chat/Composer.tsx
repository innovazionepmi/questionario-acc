"use client";

import { useState, type FormEvent } from "react";

export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (message: string) => void;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-navy/10 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        rows={1}
        disabled={disabled}
        placeholder="Scrivi qui la tua risposta…"
        className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-gold disabled:opacity-60 sm:text-base"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="h-11 shrink-0 rounded-full bg-gold px-5 text-sm font-medium text-navy transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        Invia
      </button>
    </form>
  );
}
