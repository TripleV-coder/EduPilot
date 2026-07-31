import { describe, it, expect } from "vitest";
import { sanitizePlainText, sanitizeRichText, sanitizeRequestBody } from "@/lib/sanitize";

describe("sanitizePlainText", () => {
  it("supprime toutes les balises HTML et trim", () => {
    expect(sanitizePlainText("  <b>Bonjour</b> <script>alert(1)</script>monde  ")).toBe(
      "Bonjour alert(1)monde"
    );
    expect(sanitizePlainText("sans html")).toBe("sans html");
  });
});

describe("sanitizeRichText", () => {
  it("supprime entièrement les balises dangereuses et leur contenu", () => {
    expect(sanitizeRichText("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
    expect(sanitizeRichText('<iframe src="https://evil"></iframe>avant')).toBe("avant");
    expect(sanitizeRichText("<style>body{}</style><b>gras</b>")).toBe("<b>gras</b>");
    expect(sanitizeRichText('<form action="/steal"><input></form>texte')).toBe("texte");
    expect(sanitizeRichText('<meta http-equiv="refresh"><p>x</p>')).toBe("<p>x</p>");
  });

  it("retire les balises hors whitelist en gardant leur contenu", () => {
    expect(sanitizeRichText("<video>clip</video>")).toBe("clip");
    expect(sanitizeRichText("<custom-tag>contenu</custom-tag>")).toBe("contenu");
  });

  it("supprime les gestionnaires d'événements et le style inline", () => {
    expect(sanitizeRichText('<p onclick="alert(1)">x</p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<div style="background:url(js)" class="ok">x</div>')).toBe(
      '<div class="ok">x</div>'
    );
  });

  it("bloque les URLs javascript:/data:/vbscript: dans href", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">lien</a>')).toBe("<a>lien</a>");
    expect(sanitizeRichText('<a href="data:text/html,x">lien</a>')).toBe("<a>lien</a>");
    expect(sanitizeRichText('<a href="java script:alert(1)">lien</a>')).toBe("<a>lien</a>");
    expect(sanitizeRichText('<a href="https://exemple.bj">lien</a>')).toBe(
      '<a href="https://exemple.bj">lien</a>'
    );
  });

  it("force rel=noopener noreferrer sur les liens avec target", () => {
    expect(sanitizeRichText('<a href="https://x.bj" target="_blank">lien</a>')).toBe(
      '<a href="https://x.bj" target="_blank" rel="noopener noreferrer">lien</a>'
    );
  });

  it("ne garde que les attributs whitelistés par balise", () => {
    expect(sanitizeRichText('<td colspan="2" data-x="y">c</td>')).toBe('<td colspan="2">c</td>');
    expect(sanitizeRichText('<p class="rouge">x</p>')).toBe("<p>x</p>"); // class interdit sur p
  });
});

describe("sanitizeRequestBody", () => {
  it("nettoie récursivement les chaînes (objets, tableaux, imbrications)", () => {
    const body = {
      title: "<b>Titre</b>",
      count: 3,
      ok: true,
      tags: ["<i>a</i>", 2, { nested: "<u>b</u>" }],
      child: { note: "<script>x</script>propre" },
      empty: null,
    };

    expect(sanitizeRequestBody(body)).toEqual({
      title: "Titre",
      count: 3,
      ok: true,
      tags: ["a", 2, { nested: "b" }],
      child: { note: "xpropre" },
      empty: null,
    });
  });
});
