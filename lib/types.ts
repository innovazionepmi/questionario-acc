export type SessionStatus =
  | "non_iniziata"
  | "in_corso"
  | "completata"
  | "scaduta"
  | "abbandonata";

export type ObjectiveStatus = "scoperto" | "parziale" | "coperto";

export interface Session {
  id: string;
  token: string;
  status: SessionStatus;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  hubspot_contact_id: string | null;
  started_at: string | null;
  last_activity_at: string | null;
  turn_count: number;
  created_at: string;
}

export interface Turn {
  id: string;
  session_id: string;
  turn_number: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface CoverageEntry {
  objective_id: number;
  status: ObjectiveStatus;
  extracted_content: string | null;
  updated_at: string;
}

export interface Outputs {
  session_id: string;
  recap_cliente: string;
  brief_interno: BriefInterno;
  generated_at: string;
}

export interface BriefInterno {
  dimensioni: {
    processi: string;
    tecnologia: string;
    dati: string;
    persone_competenze: string;
    governance_cultura: string;
  };
  obiettivi_non_coperti: { objective_id: number; motivo: string }[];
  note_libere: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
