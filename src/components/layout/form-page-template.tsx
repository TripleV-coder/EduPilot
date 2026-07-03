"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell, type PageBreadcrumb } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";

interface FormPageTemplateProps {
    /** Permission(s) RBAC exigée(s) par PageGuard */
    permission?: Permission | Permission[];
    /** Rôles autorisés par PageGuard */
    roles?: UserRole[];
    /** Lien du bouton retour (liste parente) */
    backHref: string;
    title: string;
    description?: string;
    breadcrumbs?: PageBreadcrumb[];
    /** Largeur max du conteneur (défaut max-w-4xl) */
    maxWidth?: string;
    /** Classes additionnelles du conteneur (ex: "pb-10") */
    className?: string;
    children: React.ReactNode;
}

/**
 * Chrome commun des pages de création (dashboard/xxx/new) : garde RBAC,
 * PageShell, bouton retour et en-tête. Le contenu (bandeaux,
 * cartes, formulaire) reste à la charge de la page.
 */
export function FormPageTemplate({
    permission,
    roles,
    backHref,
    title,
    description,
    breadcrumbs,
    maxWidth = "max-w-4xl",
    className,
    children,
}: FormPageTemplateProps) {
    return (
        <PageGuard permission={permission} roles={roles}>
            <PageShell className={cn(maxWidth, className)}>
                <div className="flex items-center gap-4">
                    <Link href={backHref}>
                        <Button variant="outline" size="icon" aria-label="Retour à la liste">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <PageHeader
                        title={title}
                        description={description}
                        breadcrumbs={breadcrumbs}
                    />
                </div>
                {children}
            </PageShell>
        </PageGuard>
    );
}
