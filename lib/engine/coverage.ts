import { OBJECTIVES, REQUIRED_CLOSING_OBJECTIVE_IDS, SCORED_OBJECTIVE_IDS } from "./objectives";
import type { CoverageEntry, ObjectiveStatus } from "../types";

export const MAX_USER_TURNS = 18;
export const COVERAGE_THRESHOLD = 0.75;

const POINTS: Record<ObjectiveStatus, number> = {
  scoperto: 0,
  parziale: 0.5,
  coperto: 1,
};

function statusFor(coverage: CoverageEntry[], objectiveId: number): ObjectiveStatus {
  return coverage.find((c) => c.objective_id === objectiveId)?.status ?? "scoperto";
}

/** Punteggio di copertura sugli obiettivi 1-15, normalizzato tra 0 e 1. */
export function computeCoverageScore(coverage: CoverageEntry[]): number {
  const totalPoints = SCORED_OBJECTIVE_IDS.reduce(
    (sum, id) => sum + POINTS[statusFor(coverage, id)],
    0
  );
  return totalPoints / SCORED_OBJECTIVE_IDS.length;
}

/** Vero quando entrambi gli obiettivi di chiusura (aspettative + preferenza di contatto) sono stati toccati. */
export function isClosingObjectiveCovered(coverage: CoverageEntry[]): boolean {
  return REQUIRED_CLOSING_OBJECTIVE_IDS.every((id) => statusFor(coverage, id) !== "scoperto");
}

/** Condizione di completamento naturale: soglia raggiunta E obiettivi di chiusura toccati. */
export function isNaturallyComplete(coverage: CoverageEntry[]): boolean {
  return (
    computeCoverageScore(coverage) >= COVERAGE_THRESHOLD &&
    isClosingObjectiveCovered(coverage)
  );
}

/**
 * Vero quando il prossimo turno da generare sarebbe il turno 18 (l'ultimo
 * consentito) e la sessione non è ancora pronta per completarsi naturalmente
 * (soglia non raggiunta, o obiettivi di chiusura non ancora toccati): in
 * questo caso la prossima domanda deve essere la chiusura forzata, non una
 * domanda scelta liberamente dal modello.
 */
export function shouldForceClosingQuestion(
  coverage: CoverageEntry[],
  turnCount: number
): boolean {
  return (
    turnCount === MAX_USER_TURNS - 1 &&
    (computeCoverageScore(coverage) < COVERAGE_THRESHOLD || !isClosingObjectiveCovered(coverage))
  );
}

/** Vero quando la sessione deve considerarsi conclusa dopo l'ultimo turno processato. */
export function isSessionComplete(coverage: CoverageEntry[], turnCount: number): boolean {
  if (turnCount >= MAX_USER_TURNS) return true;
  return isNaturallyComplete(coverage);
}

export interface MissingObjective {
  id: number;
  label: string;
  anchorQuestion: string;
  status: ObjectiveStatus;
}

/** Obiettivi (1-17) non ancora pienamente coperti, scoperti prima dei parziali. */
export function getMissingObjectives(coverage: CoverageEntry[]): MissingObjective[] {
  const severity: Record<ObjectiveStatus, number> = { scoperto: 0, parziale: 1, coperto: 2 };
  return OBJECTIVES.filter((o) => statusFor(coverage, o.id) !== "coperto")
    .map((o) => ({
      id: o.id,
      label: o.label,
      anchorQuestion: o.anchorQuestion,
      status: statusFor(coverage, o.id),
    }))
    .sort((a, b) => severity[a.status] - severity[b.status]);
}

/** I N obiettivi mancanti più critici, da accorpare nella domanda di chiusura forzata. */
export function getCriticalMissingObjectives(
  coverage: CoverageEntry[],
  limit = 3
): MissingObjective[] {
  return getMissingObjectives(coverage).slice(0, limit);
}
