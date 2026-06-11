"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Logo,
    Spinner,
    type IconName,
} from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { RoleOnboardShell, StatTile, ShortcutCard, LabelledInput } from "./shell";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export function FallbackOnboarding({ role, user }: { role: string; user: string }) {
    return (
        <RoleOnboardShell
            role={role}
            color="brand"
            user={user}
            heroTitle="Bienvenue dans EduPilot."
            heroSub="Ton onboarding détaillé pour ce rôle arrive bientôt. En attendant, voici les écrans clés à parcourir."
            steps={[
                "Découvrir le tableau de bord",
                "Configurer ton année académique",
                "Importer tes élèves",
                "Inviter ton équipe",
                "Mettre en place les paiements",
            ]}
            currentStep={1}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <ShortcutCard
                    href="/dashboard/settings/academic-config"
                    icon="settings"
                    title="Configurer l'année académique"
                    body="Choisis trimestre ou semestre · vacances · dates de bulletin."
                />
                <ShortcutCard
                    href="/dashboard/import"
                    icon="users"
                    title="Importer tes élèves"
                    body="Upload CSV · mapping intelligent · gestion des doublons."
                />
                <ShortcutCard
                    href="/dashboard/teachers"
                    icon="users"
                    title="Inviter ton équipe enseignante"
                    body="Comptes prof · classes assignées · SMS bienvenue automatique."
                />
                <ShortcutCard
                    href="/dashboard/finance/fees"
                    icon="money"
                    title="Définir les frais de scolarité"
                    body="Tarifs par cycle · échéancier · Mobile Money."
                />
            </div>
        </RoleOnboardShell>
    );
}
