import { redirect } from "next/navigation";
import nextPackage from "next/package.json";
import { Info, Cpu, Database, Server } from "lucide-react";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import appPackage from "../../../../../../package.json";

export const dynamic = "force-dynamic";

/*
 * Toutes les valeurs sont lues sur l'instance. Avant, la page affichait des
 * chiffres inventés (« v2.4.1 », « Next.js 14 », « PostgreSQL 15 »,
 * « Licence Entreprise (Active) », « SSL valide ») : faux, et rassurants à tort.
 */
async function databaseVersion(): Promise<string | null> {
    try {
        const rows = await prisma.$queryRaw<{ server_version: string }[]>`SHOW server_version`;
        const raw = rows[0]?.server_version;
        return raw ? `PostgreSQL ${raw.split(" ")[0]}` : null;
    } catch {
        return null;
    }
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4 py-2 border-b border-border/50 last:border-b-0">
            <span className="text-muted-foreground flex items-center gap-2">
                {icon}
                {label}
            </span>
            <span className="font-medium font-mono text-foreground text-right">{value}</span>
        </div>
    );
}

export default async function SystemInfoPage() {
    // Contrôle côté serveur : ces informations sont rendues dans le HTML,
    // un garde purement client les laisserait dans la réponse.
    const session = await auth();
    if (!session?.user) redirect("/login");
    if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

    const dbVersion = await databaseVersion();
    const environment = process.env.NODE_ENV === "production" ? "Production" : process.env.NODE_ENV ?? "Inconnu";

    return (
        <PageShell>
            <PageHeader
                title="Informations système"
                description="Versions et caractéristiques techniques de cette instance, lues à l'instant."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Système" },
                    { label: "Informations" },
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border shadow-sm">
                    <CardHeader className="bg-muted/30 border-b border-border">
                        <CardTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-primary" aria-hidden="true" />
                            Instance EduPilot
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Row label="Version de l'application" value={`v${appPackage.version}`} />
                        <Row label="Environnement" value={environment} />
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                    <CardHeader className="bg-muted/30 border-b border-border">
                        <CardTitle className="flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-primary" aria-hidden="true" />
                            Caractéristiques techniques
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Row
                            label="Base de données"
                            value={dbVersion ?? "Indisponible"}
                            icon={<Database className="w-4 h-4" aria-hidden="true" />}
                        />
                        <Row
                            label="Serveur web"
                            value={`Node.js ${process.version} · Next.js ${nextPackage.version}`}
                            icon={<Server className="w-4 h-4" aria-hidden="true" />}
                        />
                        <Row label="Système d'exploitation" value={`${process.platform} ${process.arch}`} />
                    </CardContent>
                </Card>
            </div>
        </PageShell>
    );
}
