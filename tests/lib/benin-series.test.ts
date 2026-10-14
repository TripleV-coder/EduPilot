import { describe, it, expect } from "vitest";
import {
  OFFICIAL_SERIES,
  disciplineAverages,
  disciplineOf,
  rankSeries,
  seriesFamily,
  seriesFullLabel,
  seriesShortLabel,
} from "@/lib/benin/series";

describe("référentiel des séries", () => {
  it("contient les 16 séries officielles, DT compris", () => {
    expect(OFFICIAL_SERIES.map((s) => s.short)).toEqual([
      "A1", "A2", "B", "C", "D", "E", "F1", "F2", "F3", "F4", "G1", "G2", "G3", "EA", "MIA", "HR",
    ]);
    expect(seriesFullLabel("SERIE_C")).toBe("Série C — Sciences et Techniques");
    expect(seriesFullLabel("SERIE_D")).toBe("Série D — Biologie - Géologie");
    expect(seriesFullLabel("SERIE_B")).toBe("Série B — Lettres - Sciences Sociales");
    expect(seriesFullLabel("EA")).toBe("DT EA — Eau et Assainissement");
    expect(seriesShortLabel("FORMATION_PRO")).toBe("Formation professionnelle");
    expect(seriesShortLabel(null)).toBeNull();
  });

  it("range EA, MIA, HR dans la famille DT (et non E, M ou H)", () => {
    expect(seriesFamily("EA")).toBe("DT");
    expect(seriesFamily("MIA")).toBe("DT");
    expect(seriesFamily("HR")).toBe("DT");
    expect(seriesFamily("SERIE_F3")).toBe("F");
    expect(seriesFamily("SERIE_A2")).toBe("A");
    expect(seriesFamily("FORMATION_PRO")).toBeNull();
  });

  it("classe les matières sans confondre EPS/physique ni SES/sciences", () => {
    expect(disciplineOf("Éducation Physique et Sportive")).toBe("EPS");
    expect(disciplineOf("Physique-Chimie-Technologie")).toBe("PC");
    expect(disciplineOf("Sciences Économiques et Sociales")).toBe("ECO");
    expect(disciplineOf("Dessin technique")).toBe("TECH");
    expect(disciplineOf("Éducation Civique et Morale")).toBeNull();
  });

  it("distingue C (maths-physique) de D (SVT)", () => {
    const c = rankSeries(disciplineAverages([
      { name: "Mathématiques", average: 17 },
      { name: "Physique-Chimie", average: 16 },
      { name: "SVT", average: 11 },
    ]), 14);
    const d = rankSeries(disciplineAverages([
      { name: "Mathématiques", average: 11 },
      { name: "Physique-Chimie", average: 12 },
      { name: "SVT", average: 17 },
    ]), 13);
    expect(c[0].series).toBe("SERIE_C");
    expect(d[0].series).toBe("SERIE_D");
  });

  it("n'est pas influencé par l'EPS", () => {
    const base = [{ name: "Mathématiques", average: 15 }, { name: "Physique-Chimie", average: 14 }];
    const low = rankSeries(disciplineAverages([...base, { name: "EPS", average: 4 }]), 13);
    const high = rankSeries(disciplineAverages([...base, { name: "EPS", average: 19 }]), 13);
    expect(low.map((s) => s.score)).toEqual(high.map((s) => s.score));
  });

  it("pénalise une moyenne générale sous le niveau conseillé", () => {
    const avgs = disciplineAverages([{ name: "Mathématiques", average: 14 }, { name: "Physique-Chimie", average: 14 }]);
    const ok = rankSeries(avgs, 12).find((s) => s.series === "SERIE_C")!;
    const low = rankSeries(avgs, 11.99).find((s) => s.series === "SERIE_C")!;
    expect(ok.score - low.score).toBe(15);
    expect(low.warnings.join(" ")).toMatch(/sous le niveau conseillé/);
  });
});
