import { describe, it, expect } from "vitest";
import { parseCsvContent, generateCsv } from "@/lib/import/parsers/csv-parser";

describe("parseCsvContent", () => {
  it("parse un CSV simple avec en-têtes normalisés (minuscules, underscores)", () => {
    const result = parseCsvContent("Prénom,Nom De Famille\nAwa,Dossou\nBio,Soglo");

    expect(result.headers).toEqual(["prénom", "nom_de_famille"]);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0]).toEqual({ "prénom": "Awa", nom_de_famille: "Dossou" });
    expect(result.errors).toEqual([]);
  });

  it("détecte automatiquement le délimiteur point-virgule", () => {
    const result = parseCsvContent("nom;classe\nDossou;6e A");
    expect(result.headers).toEqual(["nom", "classe"]);
    expect(result.rows[0]).toEqual({ nom: "Dossou", classe: "6e A" });
  });

  it("détecte la tabulation et le pipe", () => {
    expect(parseCsvContent("a\tb\n1\t2").rows[0]).toEqual({ a: "1", b: "2" });
    expect(parseCsvContent("a|b\n1|2").rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("gère les champs entre guillemets avec délimiteurs et guillemets échappés", () => {
    const result = parseCsvContent('nom,commentaire\n"Dossou, Awa","Elle a dit ""bravo"""');
    expect(result.rows[0]).toEqual({
      nom: "Dossou, Awa",
      commentaire: 'Elle a dit "bravo"',
    });
  });

  it("ignore les lignes vides par défaut et les garde si demandé", () => {
    const content = "nom\nAwa\n\nBio\n";
    expect(parseCsvContent(content).totalRows).toBe(2);
    expect(parseCsvContent(content, { skipEmptyLines: false }).totalRows).toBe(4);
  });

  it("limite le nombre de lignes avec maxRows (préview)", () => {
    const content = "n\n1\n2\n3\n4\n5";
    expect(parseCsvContent(content, { maxRows: 2 }).totalRows).toBe(2);
  });

  it("complète les colonnes manquantes par une chaîne vide", () => {
    const result = parseCsvContent("a,b,c\n1,2");
    expect(result.rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("signale un fichier vide", () => {
    const result = parseCsvContent("");
    // Un contenu vide produit une ligne d'en-tête vide : aucune donnée
    expect(result.totalRows).toBe(0);
  });

  it("supporte une ligne d'en-tête décalée (headerRow)", () => {
    const result = parseCsvContent("commentaire ignoré\nnom,classe\nAwa,6e A", { headerRow: 1 });
    expect(result.headers).toEqual(["nom", "classe"]);
    expect(result.rows[0]).toEqual({ nom: "Awa", classe: "6e A" });
  });
});

describe("generateCsv", () => {
  it("génère un CSV avec échappement des valeurs sensibles", () => {
    const csv = generateCsv(
      ["nom", "commentaire"],
      [
        ["Dossou, Awa", 'dit "bravo"'],
        ["Soglo", null],
        ["Multi\nligne", 42],
      ]
    );

    expect(csv.split("\n")[0]).toBe("nom,commentaire");
    expect(csv).toContain('"Dossou, Awa"');
    expect(csv).toContain('"dit ""bravo"""');
    expect(csv).toContain("Soglo,");
    expect(csv).toContain('"Multi\nligne",42');
  });

  it("round-trip : generateCsv → parseCsvContent restitue les données", () => {
    const headers = ["nom", "valeur"];
    const rows = [["Awa, Dossou", 'a "b" c']];
    const parsed = parseCsvContent(generateCsv(headers, rows));

    expect(parsed.rows[0]).toEqual({ nom: "Awa, Dossou", valeur: 'a "b" c' });
  });
});
