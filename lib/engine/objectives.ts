export interface Objective {
  id: number;
  dimension: string;
  label: string;
  anchorQuestion: string;
}

export const OBJECTIVES: Objective[] = [
  {
    id: 1,
    dimension: "Contesto aziendale",
    label: "Settore e attività concreta",
    anchorQuestion: "Di cosa vi occupate, in concreto, ogni giorno?",
  },
  {
    id: 2,
    dimension: "Contesto aziendale",
    label: "Dimensione e struttura",
    anchorQuestion:
      "Quante persone lavorano in azienda, e come sono organizzate le funzioni principali?",
  },
  {
    id: 3,
    dimension: "Contesto aziendale",
    label: "Ruolo di chi risponde",
    anchorQuestion: "Che ruolo hai in azienda?",
  },
  {
    id: 4,
    dimension: "Processi",
    label: "Attività percepite come dispendiose/ripetitive",
    anchorQuestion:
      "Qual è l'attività che, ripensandoci, vi fa perdere più tempo del dovuto?",
  },
  {
    id: 5,
    dimension: "Processi",
    label: "Grado di documentazione dei processi",
    anchorQuestion:
      "Se domani dovessi spiegare a un nuovo assunto come si fa questo lavoro, esisterebbe qualcosa di scritto o dovrebbe imparare guardando qualcun altro?",
  },
  {
    id: 6,
    dimension: "Processi",
    label: "Dipendenza da persone chiave",
    anchorQuestion:
      "C'è qualcosa che, se una persona specifica si assentasse per due settimane, si fermerebbe o rallenterebbe parecchio?",
  },
  {
    id: 7,
    dimension: "Tecnologia",
    label: "Strumenti software in uso",
    anchorQuestion:
      "Con quali strumenti gestite oggi il lavoro — gestionale, CRM, fogli Excel, altro?",
  },
  {
    id: 8,
    dimension: "Tecnologia",
    label: "Integrazione tra strumenti",
    anchorQuestion:
      "Questi strumenti si parlano tra loro, o passate informazioni a mano da uno all'altro?",
  },
  {
    id: 9,
    dimension: "Tecnologia",
    label: "Digitalizzazione dei dati",
    anchorQuestion:
      "Le informazioni che usate ogni giorno sono digitali, o c'è ancora molta carta di mezzo?",
  },
  {
    id: 10,
    dimension: "Dati",
    label: "Dove risiedono e quanto sono strutturati",
    anchorQuestion:
      "Dove tenete le informazioni più importanti dell'azienda, e quanto le trovate facilmente quando vi servono?",
  },
  {
    id: 11,
    dimension: "Persone & competenze",
    label: "Confidenza digitale del team",
    anchorQuestion:
      "Come si trova il tuo team quando si tratta di imparare a usare un nuovo strumento software?",
  },
  {
    id: 12,
    dimension: "Persone & competenze",
    label: "Referente interno potenziale",
    anchorQuestion:
      "C'è qualcuno in azienda che potrebbe seguire da vicino un progetto di innovazione, o saresti tu in prima persona?",
  },
  {
    id: 13,
    dimension: "Governance & cultura",
    label: "Origine della spinta verso l'AI",
    anchorQuestion: "Cosa ti ha fatto venire voglia di guardare all'AI proprio adesso?",
  },
  {
    id: 14,
    dimension: "Governance & cultura",
    label: "Apertura al cambiamento (storico)",
    anchorQuestion:
      "In passato avete introdotto nuovi strumenti o modi di lavorare? Come è andata?",
  },
  {
    id: 15,
    dimension: "Governance & cultura",
    label: "Chi decide davvero",
    anchorQuestion: "Se decideste di procedere con qualcosa, chi darebbe il via libera?",
  },
  {
    id: 16,
    dimension: "Chiusura",
    label: "Aspettative sulla call",
    anchorQuestion: "Cosa vorresti portarti a casa dalla call gratuita?",
  },
];

export const SCORED_OBJECTIVE_IDS = OBJECTIVES.filter((o) => o.id <= 15).map(
  (o) => o.id
);
export const CLOSING_OBJECTIVE_ID = 16;

export function getObjective(id: number): Objective {
  const obj = OBJECTIVES.find((o) => o.id === id);
  if (!obj) throw new Error(`Obiettivo sconosciuto: ${id}`);
  return obj;
}
