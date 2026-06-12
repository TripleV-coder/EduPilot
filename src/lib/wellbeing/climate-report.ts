/**
 * Rapport climat scolaire (P2.5) — génération PDF côté client à partir des
 * données réelles de /api/wellbeing/overview. Conforme au protocole MEMP :
 * KPIs, signalements en cours, baromètre pulse et rendez-vous de la cellule.
 */

export interface ClimateReportInput {
  schoolName?: string;
  kpis: {
    activeReports: number;
    reportsAnonymous: number;
    reportsNominative: number;
    psyAppointmentsThisWeek: number;
    climateScore: number | null;
    pulseResponses: number;
  };
  reports: {
    tag: string;
    category: string;
    excerpt: string;
    severity: string;
    severityLabel: string | null;
    status: string;
    createdAt: string;
  }[];
  pulseWeeks: { weekLabel: string; value: number; responses: number }[];
  pulseStats: { label: string; value: number | null }[];
  appointments: {
    startAt: string;
    durationMinutes: number;
    kind: string;
    anonymousLabel: string | null;
    isUrgent: boolean;
  }[];
}

const STATUS_FR: Record<string, string> = {
  OPEN: "Ouvert",
  IN_REVIEW: "En analyse",
  IN_FOLLOWUP: "Suivi en cours",
  CLOSED: "Clôturé",
};

export interface ClimateReportSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Transforme l'overview en sections tabulaires (pur — testé unitairement).
 */
export function buildClimateReportSections(data: ClimateReportInput): ClimateReportSection[] {
  const sections: ClimateReportSection[] = [];

  sections.push({
    title: "Indicateurs clés",
    headers: ["Indicateur", "Valeur"],
    rows: [
      ["Score climat (pulse hebdo)", data.kpis.climateScore !== null ? `${data.kpis.climateScore}/10` : "Pas encore de réponses"],
      ["Réponses au baromètre", data.kpis.pulseResponses],
      ["Signalements actifs", data.kpis.activeReports],
      ["dont anonymes", data.kpis.reportsAnonymous],
      ["dont nominatifs", data.kpis.reportsNominative],
      ["RDV psy cette semaine", data.kpis.psyAppointmentsThisWeek],
    ],
  });

  if (data.reports.length > 0) {
    sections.push({
      title: "Signalements en cours",
      headers: ["Date", "Source", "Catégorie", "Gravité", "Statut", "Résumé"],
      rows: data.reports.map((report) => [
        new Date(report.createdAt).toLocaleDateString("fr-FR"),
        report.tag,
        report.category,
        report.severityLabel ?? report.severity,
        STATUS_FR[report.status] ?? report.status,
        report.excerpt,
      ]),
    });
  }

  if (data.pulseWeeks.length > 0) {
    sections.push({
      title: "Baromètre climat — évolution hebdomadaire",
      headers: ["Semaine", "Score /10", "Réponses"],
      rows: data.pulseWeeks.map((week) => [week.weekLabel, week.value, week.responses]),
    });
  }

  const answeredStats = data.pulseStats.filter((stat) => stat.value !== null);
  if (answeredStats.length > 0) {
    sections.push({
      title: "Baromètre climat — détail des questions",
      headers: ["Question", "Réponses positives"],
      rows: answeredStats.map((stat) => [stat.label, `${stat.value}%`]),
    });
  }

  if (data.appointments.length > 0) {
    sections.push({
      title: "Rendez-vous de la cellule d'écoute",
      headers: ["Date", "Durée", "Type", "Élève", "Urgence"],
      rows: data.appointments.map((appointment) => [
        new Date(appointment.startAt).toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        `${appointment.durationMinutes} min`,
        appointment.kind,
        appointment.anonymousLabel ?? "—",
        appointment.isUrgent ? "OUI" : "non",
      ]),
    });
  }

  return sections;
}

/**
 * Génère et télécharge le PDF (client uniquement — jspdf en import dynamique).
 */
export async function downloadClimateReport(data: ClimateReportInput): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const now = new Date();

  doc.setFontSize(16);
  doc.text("Rapport climat scolaire", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${data.schoolName ?? "EduPilot"} — généré le ${now.toLocaleDateString("fr-FR")} · Conforme protocole MEMP 2024`,
    14,
    23
  );
  doc.setTextColor(0);

  let cursorY = 30;
  for (const section of buildClimateReportSections(data)) {
    doc.setFontSize(12);
    doc.text(section.title, 14, cursorY + 6);
    autoTable(doc, {
      startY: cursorY + 9,
      head: [section.headers],
      body: section.rows,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14, right: 14 },
    });
    cursorY =
      (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY + 40;
    if (cursorY > 250) {
      doc.addPage();
      cursorY = 14;
    }
  }

  doc.save(`rapport-climat_${now.toISOString().split("T")[0]}.pdf`);
}
