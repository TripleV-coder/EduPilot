"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";

import { Avatar, Badge, Button, Card, Icon, Input } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";

interface ProfileData {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
}

export default function ProfileSettingsPage() {
    const { status, update: updateSession } = useSession();
    const {
        data: profileData,
        error: profileError,
        isLoading: profileLoading,
    } = useSWR<ProfileData>("/api/user/profile", fetcher);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (profileData) {
            setFirstName(profileData.firstName || "");
            setLastName(profileData.lastName || "");
            setEmail(profileData.email || "");
            setPhone(profileData.phone || "");
            setAvatar(profileData.avatar || null);
        }
    }, [profileData]);

    const fullName = `${firstName} ${lastName}`.trim() || "Utilisateur";

    async function handleSave() {
        setSaving(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    phone: phone || null,
                    avatar,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Erreur lors de la sauvegarde");
            }

            await updateSession();

            setSuccessMsg("Profil mis à jour avec succès !");
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
            setTimeout(() => setErrorMsg(null), 5000);
        } finally {
            setSaving(false);
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setErrorMsg("L'image ne doit pas dépasser 2 Mo.");
            setTimeout(() => setErrorMsg(null), 5000);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setAvatar(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => setAvatar(null);

    if (status === "loading" || profileLoading) {
        return (
            <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
                <PageShell className="max-w-4xl pb-12">
                    <PageHeader
                        title="Mon profil"
                        description="Gère tes informations personnelles et tes coordonnées."
                        breadcrumbs={[
                            { label: "Paramètres", href: "/dashboard/settings" },
                            { label: "Profil" },
                        ]}
                    />
                    <PageLoading label="Chargement du profil…" />
                </PageShell>
            </PageGuard>
        );
    }

    if (profileError) {
        return (
            <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
                <PageShell className="max-w-4xl pb-12">
                    <PageHeader
                        title="Mon profil"
                        breadcrumbs={[
                            { label: "Paramètres", href: "/dashboard/settings" },
                            { label: "Profil" },
                        ]}
                    />
                    <PageError message="Impossible de charger ton profil. Réessaie plus tard." />
                </PageShell>
            </PageGuard>
        );
    }

    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Mon profil"
                    description="Gère tes informations personnelles et tes coordonnées."
                    breadcrumbs={[
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Profil" },
                    ]}
                />

                {successMsg ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-success-500)",
                            background: "var(--eduflow-success-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="success" size={18} color="var(--eduflow-success-700)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-success-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {successMsg}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {errorMsg ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {errorMsg}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* Photo de profil */}
                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="users" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Photo de profil
                        </h3>
                    </div>
                    <div className="flex flex-col items-start gap-5 px-5 py-5 sm:flex-row sm:items-center">
                        <div
                            className="relative grid place-items-center"
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: "50%",
                                background: "var(--brand-50)",
                                color: "var(--brand-700)",
                                overflow: "hidden",
                                boxShadow: "var(--eduflow-shadow-sm)",
                            }}
                        >
                            {avatar ? (
                                <Image
                                    src={avatar}
                                    alt="Photo de profil"
                                    fill
                                    unoptimized
                                    sizes="96px"
                                    style={{ objectFit: "cover" }}
                                />
                            ) : (
                                <Avatar name={fullName} size="xl" />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                                <label
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold"
                                    style={{
                                        borderRadius: 10,
                                        border: "1px solid var(--eduflow-border-default)",
                                        background: "var(--eduflow-surface-card)",
                                        color: "var(--eduflow-text-primary)",
                                        transition:
                                            "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                    }}
                                >
                                    <Icon name="download" size={14} />
                                    Changer l&apos;image
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/gif"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                </label>
                                <Button
                                    variant="ghost"
                                    onClick={handleRemoveImage}
                                    disabled={!avatar}
                                    icon="x"
                                >
                                    Supprimer
                                </Button>
                            </div>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                    margin: 0,
                                }}
                            >
                                JPG, GIF ou PNG. Taille maximale 2 Mo.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Informations de base */}
                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="info" size={18} color="var(--brand-700)" />
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Informations de base
                            </h3>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Mets à jour tes informations publiques.
                            </p>
                        </div>
                    </div>
                    <div className="px-5 py-5">
                        <div
                            className="grid gap-3"
                            style={{
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            }}
                        >
                            <Input
                                label="Prénom"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                icon="users"
                            />
                            <Input
                                label="Nom"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                icon="users"
                            />
                            <div>
                                <Input
                                    label="Email de contact"
                                    type="email"
                                    value={email}
                                    icon="sms"
                                    disabled
                                />
                                <div
                                    className="mt-1.5 flex items-center gap-1.5"
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    <Icon name="info" size={11} />
                                    L&apos;email ne peut pas être modifié.
                                </div>
                            </div>
                            <Input
                                label="Téléphone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                icon="sms"
                                placeholder="+229 …"
                            />
                        </div>
                    </div>
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"
                        style={{
                            borderColor: "var(--eduflow-border-subtle)",
                            background: "var(--eduflow-surface-sunken)",
                        }}
                    >
                        <Badge variant="neutral" size="sm">
                            Modifications enregistrées via PATCH /api/user/profile
                        </Badge>
                        <Button
                            icon={saving ? undefined : "check"}
                            loading={saving}
                            onClick={handleSave}
                            disabled={saving || !firstName.trim() || !lastName.trim()}
                        >
                            {saving ? "Enregistrement…" : "Enregistrer"}
                        </Button>
                    </div>
                </Card>
            </PageShell>
        </PageGuard>
    );
}
