const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const { JSDOM } = require("jsdom");

function normalizeText(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function htmlToMarkdownLines(htmlDoc) {
  const lines = [];

  function emit(text) {
    const t = normalizeText(text);
    if (!t) return;
    lines.push(t);
  }

  function emitHeading(level, text) {
    const t = normalizeText(text);
    if (!t) return;
    if (level === 1) lines.push(`# ${t}`);
    else if (level === 2) lines.push(`## ${t}`);
    else lines.push(`### ${t}`);
  }

  function walk(node) {
    if (!node || node.nodeType === 3) return; // Text node handled by parents
    if (node.nodeType !== 1) return; // Elements only

    const tag = node.tagName.toUpperCase();

    if (tag === "STYLE" || tag === "SCRIPT" || tag === "HEAD") return;
    if (tag === "H1") {
      emitHeading(1, node.textContent);
      return;
    }
    if (tag === "H2") {
      emitHeading(2, node.textContent);
      return;
    }
    if (tag === "H3") {
      emitHeading(3, node.textContent);
      return;
    }
    if (tag === "H4") {
      // Map H4 to H3 for our simple renderer
      emitHeading(3, node.textContent);
      return;
    }
    if (tag === "P") {
      emit(node.textContent);
      lines.push("");
      return;
    }
    if (tag === "LI") {
      const t = normalizeText(node.textContent);
      if (t) {
        lines.push(`- ${t}`);
      }
      return;
    }
    if (tag === "DIV" && node.className && String(node.className).includes("label")) {
      // Render labels as quoted emphasis
      const t = normalizeText(node.textContent);
      if (t) lines.push(`> ${t}`);
      return;
    }

    if (tag === "UL" || tag === "OL") {
      // Lists contain LI which will be handled separately in recursion
      for (const child of Array.from(node.children)) walk(child);
      return;
    }

    // Table extraction: keep a compact “row summary”
    if (tag === "TABLE") {
      const headerCells = Array.from(node.querySelectorAll("thead th")).map((th) => normalizeText(th.textContent));
      if (headerCells.length) {
        lines.push(`## Tableau (résumé)`);
        // Only first 5 data rows to keep PDF readable
        const rows = Array.from(node.querySelectorAll("tbody tr")).slice(0, 5);
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td")).map((td) => normalizeText(td.textContent));
          const pairs = headerCells.map((h, i) => (cells[i] ? `${h}: ${cells[i]}` : null)).filter(Boolean);
          if (pairs.length) lines.push(`- ${pairs.join(" ; ")}`);
        }
        lines.push("");
      }
      return;
    }

    // Default: walk children
    for (const child of Array.from(node.children)) walk(child);
  }

  const body = htmlDoc.querySelector("body");
  if (!body) return lines;
  walk(body);

  return lines.join("\n");
}

async function generatePDF() {
  const htmlPath = path.join(process.cwd(), "docs/livrables/edupilot-dossier-projet.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML introuvable: ${htmlPath}`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const dom = new JSDOM(html);
  const markdown = htmlToMarkdownLines(dom.window.document);

  const doc = new jsPDF();
  const lines = markdown.split("\n");

  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineHeight = 6.2;
  const bulletIndent = 10;

  // Remplacements “anti-jargon” : on transforme les acronymes et termes techniques
  // en formulation compréhensible par un lecteur non-tech.
  const friendlyReplacements = [
    { re: /\bSaaS\b/gi, v: "logiciel en ligne" },
    { re: /multi-tenant/gi, v: "multi-établissements (données séparées)" },
    { re: /Mobile Money/gi, v: "paiement via téléphone" },
    { re: /\bMoMo\b/gi, v: "paiement via téléphone" },
    { re: /\bRGPD\b/gi, v: "protection des données personnelles" },
    { re: /\bMFA\b/gi, v: "double vérification" },
    { re: /\bRLS\b/gi, v: "sécurité d’accès côté base de données" },
    { re: /\bRBAC\b/gi, v: "droits selon le rôle" },
    { re: /\bAPI\b/gi, v: "services" },
    { re: /Routes API/gi, v: "fonctions de l’application" },
    { re: /Permissions RBAC/gi, v: "droits selon le rôle (permissions)" },
    { re: /\bLMS\b/gi, v: "plateforme de cours" },
    { re: /\bLXP\b/gi, v: "plateforme d’apprentissage" },
    { re: /EdTech/gi, v: "technologies pour l’éducation" },
    { re: /\bIA\b/gi, v: "aide intelligente" },
    { re: /IA\s*opt-?in/gi, v: "aide intelligente (sur demande)" },
    { re: /\bwebhooks\b/gi, v: "notifications automatiques" },
    { re: /\bTOTP\b/gi, v: "code à 6 chiffres" },
    { re: /bcrypt cost\s*\d+/gi, v: "niveau de chiffrement élevé" },
    { re: /\bbcrypt\b/gi, v: "chiffrement" },
    { re: /\blockout\b/gi, v: "blocage" },
    { re: /\bRate-limit\b/gi, v: "limitation des tentatives" },
    { re: /\bRedis\b/gi, v: "compteur partagé" },
    { re: /\bPostgres\b/gi, v: "base de données" },
    { re: /\bmiddleware\b/gi, v: "couche de sécurité" },
    { re: /audit-logs/gi, v: "journal de contrôle" },
    { re: /audit logs/gi, v: "journal de contrôle" },
    { re: /access-control/gi, v: "contrôle d’accès" },
    { re: /\bACL\b/gi, v: "droits d’accès" },
  ];

  function applyFriendlyReplacements(s) {
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
    return doc.splitTextToSize(text, width);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("EduPilot — Dossier de présentation", margin, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (let rawLine of lines) {
    let line = rawLine.trimEnd();
    line = applyFriendlyReplacements(line);

    if (!line.trim()) {
      y += 3;
      continue;
    }

    ensureSpace(lineHeight);

    if (line.startsWith("# ")) {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const text = line.slice(2);
      const splitText = wrappedText(text, 14, margin, pageWidth - margin * 2);
      doc.text(splitText, margin, y);
      y += splitText.length * 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      continue;
    }
    if (line.startsWith("## ")) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const text = line.slice(3);
      const splitText = wrappedText(text, 12, margin, pageWidth - margin * 2);
      doc.text(splitText, margin, y);
      y += splitText.length * 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      continue;
    }
    if (line.startsWith("### ")) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const text = line.slice(4);
      const splitText = wrappedText(text, 11, margin, pageWidth - margin * 2);
      doc.text(splitText, margin, y);
      y += splitText.length * lineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      continue;
    }

    if (/^(\-|\*|•)\s+/.test(line)) {
      const item = line.replace(/^(\-|\*|•)\s+/, "");
      const splitText = wrappedText(item, 10, margin + bulletIndent, pageWidth - margin * 2 - bulletIndent);
      doc.text("•", margin, y);
      doc.text(splitText, margin + bulletIndent, y);
      y += splitText.length * lineHeight;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quote = line.replace(/^>\s+/, "");
      doc.setFont("helvetica", "italic");
      const splitText = wrappedText(quote, 10, margin + bulletIndent, pageWidth - margin * 2 - bulletIndent);
      doc.text(splitText, margin + bulletIndent, y);
      y += splitText.length * lineHeight;
      doc.setFont("helvetica", "normal");
      continue;
    }

    const splitText = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(splitText, margin, y);
    y += splitText.length * lineHeight;
  }

  const outputPath = path.join(process.cwd(), "docs/livrables/EduPilot-Dossier-Projet.pdf");
  doc.save(outputPath);
  console.log(`PDF généré: ${outputPath}`);
}

generatePDF().catch((e) => {
  console.error(e);
  process.exit(1);
});

