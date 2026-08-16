const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

async function generatePDF() {
    const doc = new jsPDF();
    const markdownPath = "/home/triple-v/.gemini/antigravity/brain/3d7eac8e-da44-473d-9816-d6e86147969e/presentation_associe.md";
    const rawContent = fs.readFileSync(markdownPath, "utf-8");

    // Ajout d’une entrée “non tech” avant le contenu généré.
    // Objectif : donner immédiatement le contexte et traduire les notions clés en langage simple.
    const nonTechIntro = [
        "# 00 — Lecture facile (pour non-tech)",
        "",
        "Ce dossier explique simplement :",
        "- Le problème (avec des chiffres quand c’est possible)",
        "- Pourquoi ça arrive (les causes concrètes)",
        "- La solution EduPilot (ce que ça change pour une école)",
        "",
        "Mini-glossaire :",
        "- SaaS : logiciel utilisé en ligne (pas à installer).",
        "- Multi-tenant : plusieurs écoles sur la même plateforme, mais les données restent séparées.",
        "- Mobile Money : paiements via téléphone (souvent le rail principal).",
        "- RGPD : règles pour protéger les données personnelles.",
        "- MFA : double vérification pour mieux sécuriser les comptes.",
        "- RLS : sécurité au niveau base de données, pour n’afficher que les données de l’école.",
        "",
        "---",
        "",
    ].join("\n");

    const content = `${nonTechIntro}\n${rawContent}`;

    // Nettoyage sommaire du Markdown pour le PDF
    const lines = content.split("\n");
    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const lineHeight = 6.2;
    const bulletIndent = 10;

    const friendlyReplacements = [
        { re: /multi-tenant/gi, v: "multi-tenant (plusieurs écoles, données séparées)" },
        { re: /\bRGPD\b/g, v: "RGPD (protection des données personnelles)" },
        { re: /\bMFA\b/g, v: "MFA (double vérification)" },
        { re: /\bRLS\b/g, v: "RLS (sécurité au niveau base de données)" },
        { re: /\bMobile Money\b/gi, v: "Mobile Money (paiements via téléphone)" },
    ];

    function applyReplacements(s) {
        let out = s;
        for (const r of friendlyReplacements) out = out.replace(r.re, r.v);
        return out;
    }

    function ensureSpace(heightNeeded) {
        if (y + heightNeeded > 270) {
            doc.addPage();
            y = 20;
        }
    }

    function wrappedText(text, fontSize, x, width) {
        doc.setFontSize(fontSize);
        const splitText = doc.splitTextToSize(text, width);
        return splitText;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("EduPilot — Dossier Projet (lecture facile)", margin, y);
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    for (let line of lines) {
        line = applyReplacements(line);

        // Saut de page si nécessaire
        ensureSpace(lineHeight);

        if (line.startsWith("# ")) {
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(line.replace("# ", ""), margin, y, { maxWidth: pageWidth - margin * 2 });
            y += 12;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
        } else if (line.startsWith("## ")) {
            y += 3;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(line.replace("## ", ""), margin, y, { maxWidth: pageWidth - margin * 2 });
            y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
        } else if (line.startsWith("### ")) {
            doc.setFont("helvetica", "bold");
            const parts = wrappedText(line.replace("### ", ""), 11, margin, pageWidth - margin * 2);
            doc.text(parts, margin, y);
            y += parts.length * lineHeight;
            doc.setFont("helvetica", "normal");
        } else if (line.trim() === "" || line.trim() === "---") {
            y += line.trim() === "---" ? 6 : 3;
        } else if (/^(\-|\*|•)\s+/.test(line)) {
            // List bullet
            const item = line.replace(/^(\-|\*|•)\s+/, "");
            const splitText = wrappedText(item, 10, margin + bulletIndent, pageWidth - margin * 2 - bulletIndent);
            // Bullet char
            doc.text("•", margin, y);
            doc.text(splitText, margin + bulletIndent, y);
            y += splitText.length * lineHeight;
        } else if (/^\d+\.\s+/.test(line)) {
            // List numbering
            const item = line.replace(/^\d+\.\s+/, "");
            const splitText = wrappedText(item, 10, margin + bulletIndent, pageWidth - margin * 2 - bulletIndent);
            doc.text("—", margin, y);
            doc.text(splitText, margin + bulletIndent, y);
            y += splitText.length * lineHeight;
        } else if (/^>\s+/.test(line)) {
            // Blockquote: on le rend plus “léger” visuellement
            const quote = line.replace(/^>\s+/, "");
            doc.setFont("helvetica", "italic");
            const splitText = wrappedText(quote, 10, margin + bulletIndent, pageWidth - margin * 2 - bulletIndent);
            doc.text(splitText, margin + bulletIndent, y);
            doc.setFont("helvetica", "normal");
            y += splitText.length * lineHeight;
        } else {
            const splitText = doc.splitTextToSize(line, pageWidth - margin * 2);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
        }
    }

    const outputPath = path.join(process.cwd(), "EduPilot_Dossier_Technique.pdf");
    doc.save(outputPath);
    console.log(`PDF généré avec succès dans : ${outputPath}`);
}

generatePDF().catch(console.error);
