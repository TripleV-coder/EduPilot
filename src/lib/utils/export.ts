export interface ExportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  timestamp?: Date;
}

/**
 * Échappe une cellule CSV : double les guillemets internes et neutralise les
 * préfixes de formule (= + - @) qu'Excel/LibreOffice exécuteraient à
 * l'ouverture (CSV formula injection via un nom d'élève piégé).
 */
export function escapeCsvCell(cell: string | number): string {
  let value = String(cell).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(value)) {
    value = `'${value}`;
  }
  return `"${value}"`;
}

export function exportToCSV(data: ExportData): void {
  const { title, headers, rows, timestamp } = data;
  const date = (timestamp || new Date()).toISOString().split("T")[0];
  const filename = `${title}_${date}.csv`;

  const csvContent = [
    [title],
    [],
    headers,
    ...rows,
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(data: ExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const { title, headers, rows, timestamp } = data;
  const doc = new jsPDF();
  const date = (timestamp || new Date()).toLocaleDateString();

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Généré le ${date}`, 14, 25);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 35,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  });

  const filename = `${title}_${date.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
