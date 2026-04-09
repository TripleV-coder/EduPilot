const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

async function generatePDF() {
    const doc = new jsPDF();
    const markdownPath = "/home/triple-v/.gemini/antigravity/brain/3d7eac8e-da44-473d-9816-d6e86147969e/presentation_associe.md";
    const content = fs.readFileSync(markdownPath, "utf-8");

    // Nettoyage sommaire du Markdown pour le PDF
    const lines = content.split("\n");
    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const lineHeight = 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Rapport Technique : EduPilot", margin, y);
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    for (let line of lines) {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        if (line.startsWith("# ")) {
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(line.replace("# ", ""), margin, y);
            y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
        } else if (line.startsWith("## ")) {
            y += 3;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(line.replace("## ", ""), margin, y);
            y += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
        } else if (line.startsWith("### ")) {
            doc.setFont("helvetica", "bold");
            doc.text(line.replace("### ", ""), margin, y);
            y += lineHeight;
            doc.setFont("helvetica", "normal");
        } else if (line.trim() === "") {
            y += 3;
        } else {
            const splitText = doc.splitTextToSize(line, pageWidth - (margin * 2));
            doc.text(splitText, margin, y);
            y += (splitText.length * lineHeight);
        }
    }

    const outputPath = path.join(process.cwd(), "EduPilot_Dossier_Technique.pdf");
    doc.save(outputPath);
    console.log(`PDF généré avec succès dans : ${outputPath}`);
}

generatePDF().catch(console.error);
