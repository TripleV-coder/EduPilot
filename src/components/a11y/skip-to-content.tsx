"use client";

/**
 * Lien d'évitement "Aller au contenu" pour l'accessibilité clavier et lecteurs d'écran.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      onClick={(e) => {
        // Cible le contenu de la page courante : #main-content (tableau de bord)
        // ou, à défaut, le premier <main> (pages publiques, authentification).
        const target = document.getElementById("main-content") ?? document.querySelector("main");
        if (!target) return;
        e.preventDefault();
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus();
        target.scrollIntoView({ block: "start" });
      }}
      className="eduflow-scope absolute left-[-9999px] top-4 z-[2000] rounded-input px-4 py-2 text-sm font-semibold no-underline outline-none transition-[left] duration-200 focus:left-4 focus-visible:ring-2 focus-visible:ring-brand-600/50"
      style={{
        background: "var(--brand-600)",
        color: "var(--eduflow-text-on-brand)",
      }}
    >
      Aller au contenu principal
    </a>
  );
}
