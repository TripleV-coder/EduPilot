import Link from "next/link";

/** En-tête minimal partagé par les pages publiques (annuaire, fiche). */
export function PublicHeader() {
    return (
        <header
            style={{
                borderBottom: "1px solid var(--eduflow-border-subtle)",
                background: "var(--eduflow-surface-card)",
            }}
        >
            <div
                className="mx-auto flex items-center justify-between"
                style={{ maxWidth: 1080, padding: "14px 20px" }}
            >
                <Link href="/" style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "var(--brand-700)" }}>
                    EduPilot
                </Link>
                <nav className="flex items-center gap-4" style={{ fontSize: 13, fontWeight: 600 }}>
                    <Link href="/ecoles" style={{ color: "var(--eduflow-text-secondary)" }}>
                        Annuaire
                    </Link>
                    <Link
                        href="/login"
                        style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            background: "var(--brand-700)",
                            color: "#fff",
                        }}
                    >
                        Se connecter
                    </Link>
                </nav>
            </div>
        </header>
    );
}
