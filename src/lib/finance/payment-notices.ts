import prisma from "@/lib/prisma";

/**
 * Avis de paiement groupés (TD-017).
 *
 * Le modèle n'a pas de facture impayée : ce qu'un élève doit découle du frais
 * (`Fee.amount`, restreint à un niveau par `Fee.classLevelCode`) moins ses
 * paiements validés. Le calcul se fait donc à la demande, sans rien écrire.
 */

/** Paiements qui soldent réellement une dette (même règle que les statistiques finance). */
const SETTLED_STATUSES = ["VERIFIED", "RECONCILED"] as const;

export type NoticeRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  matricule: string;
  className: string;
  due: number;
  paid: number;
  /** Déclaré mais pas encore validé par la comptabilité : ne réduit pas le reste. */
  pending: number;
  remaining: number;
};

export type NoticeBatch = {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  fee: { id: string; name: string; description: string | null; amount: number; dueDate: Date | null };
  classLevel: { id: string; name: string };
  academicYear: { id: string; name: string };
  rows: NoticeRow[];
};

export type NoticeError = { error: string; status: 400 | 404 };

export async function buildNoticeBatch(params: {
  feeId: string;
  classLevelId: string;
  canAccessSchool: (schoolId: string) => boolean;
}): Promise<NoticeBatch | NoticeError> {
  const fee = await prisma.fee.findUnique({
    where: { id: params.feeId },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      dueDate: true,
      classLevelCode: true,
      isActive: true,
      deletedAt: true,
      schoolId: true,
      academicYear: { select: { id: true, name: true } },
      school: { select: { name: true, address: true, phone: true, email: true } },
    },
  });
  if (!fee || fee.deletedAt || !params.canAccessSchool(fee.schoolId)) {
    return { error: "Frais introuvable", status: 404 };
  }
  if (!fee.isActive) {
    return { error: "Ce frais est désactivé.", status: 400 };
  }

  const classLevel = await prisma.classLevel.findUnique({
    where: { id: params.classLevelId },
    select: { id: true, name: true, code: true, schoolId: true },
  });
  if (!classLevel || classLevel.schoolId !== fee.schoolId) {
    return { error: "Niveau introuvable", status: 404 };
  }
  if (fee.classLevelCode && fee.classLevelCode !== classLevel.code) {
    return { error: `Ce frais ne concerne pas le niveau ${classLevel.name}.`, status: 400 };
  }

  // Un frais sans année s'applique à l'année courante de l'établissement.
  const academicYear =
    fee.academicYear ??
    (await prisma.academicYear.findFirst({
      where: { schoolId: fee.schoolId, isCurrent: true },
      select: { id: true, name: true },
    }));
  if (!academicYear) {
    return { error: "Aucune année scolaire courante : rattachez le frais à une année.", status: 400 };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      academicYearId: academicYear.id,
      status: "ACTIVE",
      deletedAt: null,
      class: { classLevelId: classLevel.id, schoolId: fee.schoolId },
      student: { deletedAt: null },
    },
    select: {
      studentId: true,
      class: { select: { name: true } },
      student: { select: { matricule: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  // groupBy plutôt qu'un _count relationnel : payments est sous RLS.
  const sums = studentIds.length
    ? await prisma.payment.groupBy({
        by: ["studentId", "status"],
        where: { feeId: fee.id, studentId: { in: studentIds }, deletedAt: null, status: { not: "CANCELLED" } },
        _sum: { amount: true },
      })
    : [];

  const paidBy = new Map<string, number>();
  const pendingBy = new Map<string, number>();
  for (const sum of sums) {
    const target = (SETTLED_STATUSES as readonly string[]).includes(sum.status) ? paidBy : pendingBy;
    target.set(sum.studentId, (target.get(sum.studentId) ?? 0) + Number(sum._sum.amount ?? 0));
  }

  const due = Number(fee.amount);
  const seen = new Set<string>();
  const rows: NoticeRow[] = [];
  for (const enrollment of enrollments) {
    // Un transfert en cours d'année peut laisser deux inscriptions actives.
    if (seen.has(enrollment.studentId)) continue;
    seen.add(enrollment.studentId);
    const paid = paidBy.get(enrollment.studentId) ?? 0;
    rows.push({
      studentId: enrollment.studentId,
      firstName: enrollment.student.user.firstName,
      lastName: enrollment.student.user.lastName,
      matricule: enrollment.student.matricule,
      className: enrollment.class.name,
      due,
      paid,
      pending: pendingBy.get(enrollment.studentId) ?? 0,
      remaining: Math.max(0, due - paid),
    });
  }
  rows.sort((a, b) => a.className.localeCompare(b.className, "fr") || a.lastName.localeCompare(b.lastName, "fr"));

  return {
    school: fee.school,
    fee: { id: fee.id, name: fee.name, description: fee.description, amount: due, dueDate: fee.dueDate },
    classLevel: { id: classLevel.id, name: classLevel.name },
    academicYear,
    rows,
  };
}

export function isNoticeError(result: NoticeBatch | NoticeError): result is NoticeError {
  return "error" in result;
}

/** Montant FCFA lisible par jsPDF (Helvetica n'a pas l'espace fine insécable de toLocaleString). */
function fcfa(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

/** Un avis par page, pour chaque élève qui doit encore quelque chose. */
export async function renderNoticesPdf(batch: NoticeBatch, issuedAt = new Date()): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const debtors = batch.rows.filter((row) => row.remaining > 0);

  debtors.forEach((row, index) => {
    if (index > 0) doc.addPage();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(batch.school.name, 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const contact = [batch.school.address, batch.school.phone && `Tél : ${batch.school.phone}`, batch.school.email]
      .filter(Boolean)
      .join(" · ");
    if (contact) doc.text(contact, 105, 27, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("AVIS DE PAIEMENT", 105, 43, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Émis le ${issuedAt.toLocaleDateString("fr-FR")}`, 20, 53);
    doc.text(`Année scolaire : ${batch.academicYear.name}`, 190, 53, { align: "right" });

    doc.setFillColor(240, 240, 240);
    doc.rect(20, 59, 170, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${row.lastName.toUpperCase()} ${row.firstName}`, 25, 67);
    doc.setFont("helvetica", "normal");
    doc.text(`Matricule : ${row.matricule}`, 25, 74);
    doc.text(`Classe : ${batch.classLevel.name} — ${row.className}`, 25, 80);

    autoTable(doc, {
      startY: 91,
      head: [["Désignation", "Montant dû", "Déjà réglé", "Reste à payer"]],
      body: [[batch.fee.name, fcfa(row.due), fcfa(row.paid), fcfa(row.remaining)]],
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    });

    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    if (batch.fee.dueDate) {
      doc.setFont("helvetica", "bold");
      doc.text(`À régler avant le ${batch.fee.dueDate.toLocaleDateString("fr-FR")}`, 20, y);
      doc.setFont("helvetica", "normal");
      y += 7;
    }
    if (row.pending > 0) {
      doc.text(`${fcfa(row.pending)} déclarés sont en cours de vérification et ne sont pas encore déduits.`, 20, y);
      y += 7;
    }
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Si vous avez déjà réglé ce montant, merci de ne pas tenir compte de cet avis.", 20, y + 4);
    doc.setTextColor(0);
  });

  return doc.output("arraybuffer");
}
