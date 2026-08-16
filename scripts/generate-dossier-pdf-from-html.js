const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function generatePDF() {
  const htmlPath = path.join(process.cwd(), "docs/livrables/edupilot-dossier-projet.html");
  const outputPath = path.join(process.cwd(), "EduPilot_Dossier_Technique.pdf");

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML source introuvable: ${htmlPath}`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });

  // Charge le HTML directement pour conserver la mise en page CSS (table, callouts, page breaks).
  await page.setContent(html, { waitUntil: "load" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  });

  await browser.close();
  console.log(`PDF généré: ${outputPath}`);
}

generatePDF().catch((e) => {
  console.error(e);
  process.exit(1);
});

