import { ImageResponse } from "next/og";

// Remplace /og-image.jpg, déclaré dans les métadonnées mais jamais versionné :
// chaque lien partagé affichait une image cassée.
export const alt = "EduPilot — gestion scolaire pour les établissements du Bénin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "72px 80px",
                    background: "#1c1917",
                    color: "#fafaf9",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: "hsl(32, 95%, 52%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 38,
                            fontWeight: 800,
                            color: "#1c1917",
                        }}
                    >
                        E
                    </div>
                    <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>EduPilot</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 960 }}>
                        La gestion scolaire des établissements du Bénin
                    </div>
                    <div style={{ fontSize: 30, color: "#d6d3d1" }}>
                        Notes, bulletins, présences, finances et liaison avec les familles.
                    </div>
                </div>
                <div style={{ display: "flex", height: 8, width: 160, borderRadius: 4, background: "hsl(32, 95%, 52%)" }} />
            </div>
        ),
        size,
    );
}
