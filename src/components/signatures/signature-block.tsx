"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { Button, Card, Icon } from "@/components/edu";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { SignaturePad, type SignatureValue } from "./signature-pad";

interface SignatureRow {
    id: string;
    signerName: string;
    signerRole: string;
    method: "DRAWN" | "TYPED" | "OTP";
    signatureData: string | null;
    signedAt: string;
}

export interface SignatureBlockProps {
    docType: "REPORT_CARD" | "CERTIFICATE" | "PARENT_AUTHORIZATION" | "STAFF_CONTRACT";
    docId: string;
    /** Instantané canonique du document, scellé par le hash de contenu. */
    payload: unknown;
    /** Autorise l'utilisateur courant à signer (sinon lecture seule). */
    canSign?: boolean;
    title?: string;
}

/**
 * Bloc de signature d'un document : liste les signataires et, si autorisé,
 * permet d'apposer une signature (tracé ou saisie).
 */
export function SignatureBlock({ docType, docId, payload, canSign = false, title = "Signatures" }: SignatureBlockProps) {
    const key = `/api/signatures?docType=${docType}&docId=${encodeURIComponent(docId)}`;
    const { data, mutate } = useSWR<{ signatures: SignatureRow[] }>(key, fetcher);
    const [value, setValue] = useState<SignatureValue | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const signatures = data?.signatures ?? [];

    async function sign() {
        if (!value) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ docType, docId, method: value.method, signatureData: value.signatureData, payload }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.error);
            }
            toast.success("Document signé.");
            setValue(null);
            await mutate();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : "Échec de la signature.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Card padding={0}>
            <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <Icon name="pencil" size={18} color="var(--brand-700)" />
                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>{title}</h3>
            </div>

            <div className="px-5 py-4">
                {signatures.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)", margin: 0 }}>
                        Aucune signature pour le moment.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {signatures.map((s) => (
                            <li key={s.id} className="flex items-center gap-3">
                                <div
                                    className="grid place-items-center"
                                    style={{ width: 96, height: 44, borderRadius: 8, border: "1px solid var(--eduflow-border-subtle)", background: "#fff", overflow: "hidden", flexShrink: 0 }}
                                >
                                    {s.method === "DRAWN" && s.signatureData ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={s.signatureData} alt="Signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                                    ) : (
                                        <span style={{ fontFamily: "cursive", fontSize: 16 }}>{s.signatureData ?? s.signerName}</span>
                                    )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.signerName}</div>
                                    <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                        {formatUserRoleLabel(s.signerRole)} · {new Date(s.signedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                                    </div>
                                </div>
                                <Icon name="success" size={16} color="var(--eduflow-success-600)" />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {canSign ? (
                <div className="border-t px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)", background: "var(--eduflow-surface-sunken)" }}>
                    <SignaturePad onChange={setValue} />
                    <div className="mt-3">
                        <Button icon="pencil" onClick={sign} loading={submitting} disabled={!value}>
                            Signer le document
                        </Button>
                    </div>
                </div>
            ) : null}
        </Card>
    );
}
