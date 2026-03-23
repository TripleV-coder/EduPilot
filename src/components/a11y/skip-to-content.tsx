"use client";

/**
 * Lien d'évitement "Aller au contenu" pour l'accessibilité clavier et lecteurs d'écran.
 * Caché hors focus, visible au focus (premier tab).
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="absolute left-[-9999px] top-4 z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground no-underline outline-none transition-[left] duration-200 focus:left-4 focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Aller au contenu principal
    </a>
  );
}
