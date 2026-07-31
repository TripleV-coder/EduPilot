"use client";

/**
 * Lien d'évitement "Aller au contenu" pour l'accessibilité clavier et lecteurs d'écran.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
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
