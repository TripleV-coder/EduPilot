import { describe, expect, it } from "vitest";
import { safeVideoLink, toEmbeddableVideoUrl } from "@/lib/utils/video-embed";

/**
 * Vidéo d'une leçon : seul un lecteur YouTube/Vimeo officiel est intégré,
 * reconstruit depuis l'identifiant (alerte CodeQL js/incomplete-url-substring-sanitization).
 */
describe("toEmbeddableVideoUrl", () => {
    it("YouTube (watch, youtu.be, shorts, embed) → lecteur youtube-nocookie", () => {
        const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
        expect(toEmbeddableVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe(expected);
        expect(toEmbeddableVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(expected);
        expect(toEmbeddableVideoUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe(expected);
        expect(toEmbeddableVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(expected);
    });

    it("Vimeo → lecteur officiel", () => {
        expect(toEmbeddableVideoUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871");
    });

    it("refuse ce qui n'est pas un lecteur officiel en HTTPS", () => {
        for (const raw of [
            "javascript:alert(1)",
            "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=<script>",
            "https://exemple.bj/cours.mp4",
            "",
            null,
        ]) {
            expect(toEmbeddableVideoUrl(raw)).toBeNull();
        }
    });

    it("lien de secours : HTTPS seulement", () => {
        expect(safeVideoLink("https://exemple.bj/cours.mp4")).toBe("https://exemple.bj/cours.mp4");
        expect(safeVideoLink("javascript:alert(1)")).toBeNull();
        expect(safeVideoLink("http://exemple.bj/cours.mp4")).toBeNull();
    });
});
