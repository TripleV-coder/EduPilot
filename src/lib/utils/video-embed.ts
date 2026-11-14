/**
 * Adresse de lecteur intégrable pour la vidéo d'une leçon, ou null.
 *
 * Seules des adresses HTTPS de YouTube et Vimeo sont intégrées dans un
 * <iframe>, converties vers leur lecteur officiel à partir de l'identifiant
 * de la vidéo (jamais l'adresse saisie telle quelle) : une adresse
 * `javascript:` ou un autre site ne peut pas s'afficher dans l'application.
 * Toute autre adresse HTTPS est proposée comme simple lien (safeVideoLink).
 */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{4,15}$/;

function parseHttps(raw: string | null | undefined): URL | null {
    if (!raw) return null;
    try {
        const url = new URL(raw.trim());
        return url.protocol === "https:" ? url : null;
    } catch {
        return null;
    }
}

export function toEmbeddableVideoUrl(raw: string | null | undefined): string | null {
    const url = parseHttps(raw);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");

    let youtubeId: string | null = null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
        if (url.pathname === "/watch") youtubeId = url.searchParams.get("v");
        else {
            const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
            youtubeId = match?.[1] ?? null;
        }
    } else if (host === "youtu.be") {
        youtubeId = url.pathname.slice(1).split("/")[0] || null;
    }
    if (youtubeId) return YOUTUBE_ID.test(youtubeId) ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : null;

    if (host === "vimeo.com" || host === "player.vimeo.com") {
        const id = url.pathname.split("/").filter(Boolean).find((part) => VIMEO_ID.test(part));
        return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
}

/** Lien HTTPS sûr vers une vidéo non intégrable, ou null. */
export function safeVideoLink(raw: string | null | undefined): string | null {
    return parseHttps(raw)?.toString() ?? null;
}
