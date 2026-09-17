import { describe, expect, it } from "vitest";
import type { CoverageEntry } from "../types";
import {
  computeCoverageScore,
  getCriticalMissingObjectives,
  isNaturallyComplete,
  isSessionComplete,
  shouldForceClosingQuestion,
} from "./coverage";

function coverage(entries: Record<number, "scoperto" | "parziale" | "coperto">): CoverageEntry[] {
  return Object.entries(entries).map(([id, status]) => ({
    objective_id: Number(id),
    status,
    extracted_content: null,
    updated_at: new Date().toISOString(),
  }));
}

describe("computeCoverageScore", () => {
  it("è 0 quando nessun obiettivo 1-15 è coperto", () => {
    expect(computeCoverageScore([])).toBe(0);
  });

  it("è 1 quando tutti gli obiettivi 1-15 sono coperti", () => {
    const entries: Record<number, "coperto"> = {};
    for (let i = 1; i <= 15; i++) entries[i] = "coperto";
    expect(computeCoverageScore(coverage(entries))).toBe(1);
  });

  it("conta 'parziale' come mezzo punto e ignora l'obiettivo 16", () => {
    const entries: Record<number, "coperto" | "parziale"> = { 1: "coperto", 2: "parziale" };
    const score = computeCoverageScore(coverage({ ...entries, 16: "coperto" }));
    expect(score).toBeCloseTo(1.5 / 15);
  });
});

describe("isNaturallyComplete", () => {
  it("richiede sia la soglia 75% sia l'obiettivo 16 toccato", () => {
    const entries: Record<number, "coperto"> = {};
    for (let i = 1; i <= 12; i++) entries[i] = "coperto"; // 12/15 = 0.8 >= 0.75
    expect(isNaturallyComplete(coverage(entries))).toBe(false); // manca obiettivo 16
    expect(isNaturallyComplete(coverage({ ...entries, 16: "parziale" }))).toBe(true);
  });

  it("è falso sotto soglia anche con obiettivo 16 coperto", () => {
    const entries = coverage({ 1: "coperto", 2: "coperto", 16: "coperto" });
    expect(isNaturallyComplete(entries)).toBe(false);
  });
});

describe("shouldForceClosingQuestion", () => {
  it("scatta solo al turno 17 (per generare il turno 18) sotto soglia", () => {
    expect(shouldForceClosingQuestion([], 17)).toBe(true);
    expect(shouldForceClosingQuestion([], 16)).toBe(false);
    expect(shouldForceClosingQuestion([], 18)).toBe(false);
  });

  it("non scatta se la copertura è già sopra soglia", () => {
    const entries: Record<number, "coperto"> = {};
    for (let i = 1; i <= 12; i++) entries[i] = "coperto";
    expect(shouldForceClosingQuestion(coverage(entries), 17)).toBe(false);
  });
});

describe("isSessionComplete", () => {
  it("è vero al guardrail dei 18 turni indipendentemente dalla copertura", () => {
    expect(isSessionComplete([], 18)).toBe(true);
    expect(isSessionComplete([], 19)).toBe(true);
  });

  it("è vero prima del guardrail se la copertura naturale è raggiunta", () => {
    const entries: Record<number, "coperto"> = {};
    for (let i = 1; i <= 12; i++) entries[i] = "coperto";
    expect(isSessionComplete(coverage({ ...entries, 16: "coperto" }), 10)).toBe(true);
  });

  it("è falso prima del guardrail senza copertura naturale", () => {
    expect(isSessionComplete([], 5)).toBe(false);
  });
});

describe("getCriticalMissingObjectives", () => {
  it("privilegia gli obiettivi 'scoperto' rispetto ai 'parziale' e rispetta il limite", () => {
    const entries = coverage({ 1: "coperto", 2: "parziale", 3: "scoperto", 4: "scoperto" });
    const missing = getCriticalMissingObjectives(entries, 2);
    expect(missing).toHaveLength(2);
    expect(missing.every((m) => m.status === "scoperto")).toBe(true);
  });
});
