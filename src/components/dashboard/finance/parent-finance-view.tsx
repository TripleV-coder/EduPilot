"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { Block, CARD_COLORS, Empty, Figures, MODULE, initials } from "@/components/edu-homes/home-kit";
import { Badge } from "@/components/edu";
import homeStyles from "@/components/edu-homes/home.module.css";
import type { ChildFinance, FamilyChildSummary, FamilyFeeView, FamilyPaymentView, PaymentIntent } from "@/lib/finance/family-finance";

/**
 * Scolarité et paiements, vue parent.
 *
 * Chaque enfant a sa propre situation (son école, ses frais, son compte
 * marchand) : rien n'est cumulé entre enfants. Tous les montants viennent du
 * serveur ; le bouton « Payer » transmet une INTENTION (prochaine échéance,
 * solde, montant libre) que le serveur recalcule sous verrou avant d'appeler
 * le fournisseur avec le compte de l'école. Le statut d'un paiement n'est
 * jamais déduit du retour du navigateur (page de retour S4).
 */

/** Dates sérialisées par l'API. */
type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };
type ChildData = Omit<ChildFinance, "fees" | "payments"> & {
    fees: Array<Json<Omit<FamilyFeeView, "installments" | "options">> & {
        installments: Array<Json<NonNullable<FamilyFeeView["installments"]>[number]>> | null;
        options: Omit<FamilyFeeView["options"], "nextInstallment"> & {
            nextInstallment: { installmentId: string; dueDate: string; amount: number } | null;
        };
    }>;
    payments: Array<Json<FamilyPaymentView>>;
};
type FeeData = ChildData["fees"][number];

const METHOD_LABELS: Record<string, string> = {
    CASH: "Espèces",
    MOBILE_MONEY_MTN: "Mobile Money",
    MOBILE_MONEY_MOOV: "Mobile Money Moov",
    BANK_TRANSFER: "Virement bancaire",
    CHECK: "Chèque",
    OTHER: "Autre",
};

const STATUS_BADGE: Record<FamilyPaymentView["status"], { label: string; variant: "success" | "warning" | "danger" | "info" }> = {
    CONFIRMED: { label: "Confirmé", variant: "success" },
    PENDING: { label: "En attente de confirmation", variant: "info" },
    UNDER_REVIEW: { label: "En vérification", variant: "warning" },
    FAILED: { label: "Non abouti", variant: "danger" },
};

const formatFcfa = (amount: number) =>
    new Intl.NumberFormat("fr-BJ", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const formatShortDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type InstallmentRow = NonNullable<FeeData["installments"]>[number];
const installmentState = (row: InstallmentRow) =>
    row.outstanding === 0 ? "Réglée" : row.payable ? "À régler maintenant" : row.covered > 0 ? "Partiellement réglée" : "Plus tard";

export function ParentFinanceView() {
    return (
        <PageShell>
            <PageHeader
                title="Scolarité et paiements"
                description="La situation de chacun de vos enfants, dans son établissement."
                breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Scolarité et paiements" }]}
            />
            <React.Suspense fallback={<PageLoading label="Chargement…" />}>
                <FamilyFinance />
            </React.Suspense>
        </PageShell>
    );
}

function FamilyFinance() {
    const { data, error, isLoading, mutate } = useSWR<{ children: FamilyChildSummary[] }>("/api/finance/my-children", fetcher);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    if (error) return <PageError message="Impossible de charger la situation de vos enfants." onRetry={() => void mutate()} />;
    if (isLoading || !data) return <PageLoading label="Chargement de vos enfants…" />;

    const children = data.children;
    if (children.length === 0) {
        return (
            <Block id="family-none" title="Aucun enfant">
                <Empty>Aucun enfant n&apos;est encore lié à votre compte. Demandez à l&apos;établissement le code de liaison.</Empty>
            </Block>
        );
    }

    const requested = searchParams.get("enfant");
    const selected = children.find((c) => c.studentId === requested) ?? (children.length === 1 ? children[0] : null);
    const choose = (studentId: string) => router.replace(`${pathname}?enfant=${encodeURIComponent(studentId)}`, { scroll: false });

    return (
        <>
            {children.length > 1 ? (
                <Block id="family-children" title="Choisissez un enfant">
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Vos enfants">
                        {children.map((child, i) => {
                            const active = selected?.studentId === child.studentId;
                            return (
                                <li key={child.studentId} className="min-w-0">
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => choose(child.studentId)}
                                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                            active ? "border-[var(--brand-600)] bg-[var(--brand-50)]" : "border-[var(--eduflow-border-subtle)]"
                                        }`}
                                    >
                                        <span className={homeStyles.avatar} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} aria-hidden="true">
                                            {initials(`${child.firstName} ${child.lastName}`)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className={homeStyles.name} style={{ display: "block" }}>
                                                {child.firstName} {child.lastName}
                                            </span>
                                            <span className={homeStyles.detail} style={{ display: "block" }}>
                                                {child.schoolName}
                                                {child.className ? ` · ${child.className}` : ""}
                                            </span>
                                            <span className={homeStyles.detail} style={{ display: "block" }}>
                                                {child.remaining > 0 ? `Reste à payer : ${formatFcfa(child.remaining)}` : "Tout est réglé"}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Block>
            ) : null}
            {selected ? (
                <ChildPanel key={selected.studentId} studentId={selected.studentId} onChanged={() => void mutate()} />
            ) : (
                <Block id="family-pick" title="Situation financière">
                    <Empty>Choisissez un enfant pour voir ce qui reste à régler et payer ses frais.</Empty>
                </Block>
            )}
        </>
    );
}

function ChildPanel({ studentId, onChanged }: { studentId: string; onChanged: () => void }) {
    const { data, error, isLoading, mutate } = useSWR<ChildData>(`/api/finance/my-children/${encodeURIComponent(studentId)}`, fetcher);

    // Retour arrière depuis la page du fournisseur (cache du navigateur) : relire l'état réel
    React.useEffect(() => {
        const onShow = (event: PageTransitionEvent) => {
            if (event.persisted) void mutate();
        };
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, [mutate]);

    if (error) return <PageError message="Impossible de charger la situation de cet enfant." onRetry={() => void mutate()} />;
    if (isLoading || !data) return <PageLoading label="Chargement de la situation…" />;

    const { child, totals, online } = data;
    const refresh = () => {
        void mutate();
        onChanged();
    };

    return (
        <>
            <Block id="child-overview" title={`${child.firstName} ${child.lastName}`}>
                <p className={homeStyles.detail}>
                    {child.schoolName}
                    {child.className ? ` · ${child.className}` : ""}
                    {child.academicYearName ? ` · Année ${child.academicYearName}` : ""} · Matricule {child.matricule}
                </p>
                <div className="mt-4">
                    <Figures
                        items={[
                            { label: "Total des frais", value: formatFcfa(totals.billed), note: "pour l'année en cours", color: MODULE.blue },
                            { label: "Déjà payé", value: formatFcfa(totals.settled), note: "paiements confirmés", color: MODULE.green },
                            {
                                label: "En attente",
                                value: formatFcfa(totals.reserved),
                                note: totals.reserved > 0 ? "paiements en cours de confirmation" : "aucun paiement en cours",
                                color: MODULE.purple,
                            },
                            {
                                label: "Reste à payer",
                                value: formatFcfa(totals.remaining),
                                note: totals.remaining > 0 ? `dont ${formatFcfa(totals.available)} payable maintenant` : "tout est réglé",
                                color: totals.remaining > 0 ? MODULE.orange : MODULE.green,
                            },
                        ]}
                    />
                </div>
                <p role="note" className={`mt-4 text-sm ${online.available ? "text-[var(--eduflow-success-800)]" : "text-muted-foreground"}`}>
                    {online.message}
                </p>
            </Block>

            <Block id="child-fees" title="Frais de l'année">
                {data.fees.length === 0 ? (
                    <Empty>Aucun frais n&apos;est enregistré pour cet enfant cette année. Rapprochez-vous de l&apos;économat en cas de doute.</Empty>
                ) : (
                    <ul className="flex flex-col gap-4">
                        {data.fees.map((fee) => (
                            <li key={fee.feeId} className="min-w-0">
                                <FeeCard fee={fee} studentId={child.studentId} onlineAvailable={online.available} onChanged={refresh} />
                            </li>
                        ))}
                    </ul>
                )}
            </Block>

            <PaymentHistory payments={data.payments} />
        </>
    );
}

type PayState =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "redirecting" }
    | { kind: "error"; message: string };

function FeeCard({ fee, studentId, onlineAvailable, onChanged }: { fee: FeeData; studentId: string; onlineAvailable: boolean; onChanged: () => void }) {
    const { options } = fee;
    const defaultMode: PaymentIntent = options.nextInstallment ? "NEXT_INSTALLMENT" : options.fullBalance ? "FULL_BALANCE" : "AMOUNT";
    const [mode, setMode] = React.useState<PaymentIntent>(defaultMode);
    const [amountText, setAmountText] = React.useState("");
    const [state, setState] = React.useState<PayState>({ kind: "idle" });
    const inFlight = React.useRef(false);
    const fieldId = React.useId();

    // Option devenue indisponible après une relecture (paiement en attente…) : retour au montant libre
    const effectiveMode: PaymentIntent =
        (mode === "NEXT_INSTALLMENT" && !options.nextInstallment) || (mode === "FULL_BALANCE" && !options.fullBalance) ? "AMOUNT" : mode;

    // Retour arrière depuis le fournisseur : le bouton redevient utilisable, le serveur refusera tout doublon
    React.useEffect(() => {
        const onShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                inFlight.current = false;
                setState({ kind: "idle" });
            }
        };
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    const trimmed = amountText.trim();
    const freeAmount = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
    const freeError =
        effectiveMode !== "AMOUNT" || trimmed === ""
            ? null
            : !Number.isInteger(freeAmount) || freeAmount <= 0
              ? "Saisissez un montant entier en FCFA, supérieur à 0."
              : freeAmount > options.maxAmount
                ? `Le montant payable maintenant est au plus ${formatFcfa(options.maxAmount)}.`
                : null;
    // Montant annoncé sur le bouton : seulement s'il est payable tel quel
    const shownAmount =
        effectiveMode === "NEXT_INSTALLMENT"
            ? options.nextInstallment?.amount ?? 0
            : effectiveMode === "FULL_BALANCE"
              ? options.fullBalance ?? 0
              : freeError
                ? NaN
                : freeAmount;
    const busy = state.kind === "submitting" || state.kind === "redirecting";
    const canPay =
        onlineAvailable &&
        options.maxAmount > 0 &&
        !busy &&
        (effectiveMode === "AMOUNT" ? !freeError && Number.isInteger(freeAmount) && freeAmount > 0 : shownAmount > 0);

    const pay = async () => {
        if (inFlight.current || !canPay) return;
        inFlight.current = true;
        setState({ kind: "submitting" });
        try {
            const res = await fetch("/api/payments/initiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId,
                    feeId: fee.feeId,
                    provider: "FEDAPAY",
                    mode: effectiveMode,
                    ...(effectiveMode === "AMOUNT" ? { amount: freeAmount } : {}),
                }),
            });
            const body = (await res.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };
            if (res.ok && typeof body.paymentUrl === "string" && body.paymentUrl.startsWith("https://")) {
                setState({ kind: "redirecting" });
                window.location.assign(body.paymentUrl);
                return;
            }
            inFlight.current = false;
            setState({
                kind: "error",
                message: res.ok
                    ? "Le lien de paiement reçu n'est pas valide. Ne relancez pas le paiement : vérifiez son état dans l'historique."
                    : body.error ?? "Le paiement n'a pas pu être préparé. Réessayez plus tard ou réglez à l'économat.",
            });
            // Montants et paiements en attente relus : ils ont pu changer entre-temps
            onChanged();
        } catch {
            inFlight.current = false;
            setState({ kind: "error", message: "Connexion impossible. Vérifiez votre réseau, puis l'historique avant de réessayer." });
            onChanged();
        }
    };

    const radioName = `mode-${fee.feeId}`;
    return (
        <article className="rounded-xl border border-[var(--eduflow-border-subtle)] p-4" aria-labelledby={`fee-${fee.feeId}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`fee-${fee.feeId}`} className={homeStyles.name}>
                    {fee.name}
                    {!fee.isRequired ? <span className={homeStyles.detail}> · facultatif</span> : null}
                </h3>
                {fee.remaining === 0 ? <Badge variant="success">Réglé</Badge> : null}
            </div>
            {fee.description ? <p className={homeStyles.detail}>{fee.description}</p> : null}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                    <dt className="text-muted-foreground">Montant</dt>
                    <dd className="font-semibold tabular-nums">{formatFcfa(fee.billed)}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Payé</dt>
                    <dd className="font-semibold tabular-nums">{formatFcfa(fee.settled)}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">En attente</dt>
                    <dd className="font-semibold tabular-nums">{formatFcfa(fee.reserved)}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Reste</dt>
                    <dd className="font-semibold tabular-nums">{formatFcfa(fee.remaining)}</dd>
                </div>
            </dl>
            {fee.dueDate && !fee.installments ? <p className={`mt-2 ${homeStyles.detail}`}>Date limite : {formatDate(fee.dueDate)}</p> : null}

            {fee.installments && fee.installments.length > 0 ? (
                // Petit écran : une ligne par échéance, l'état toujours visible
                <ul className="mt-3 grid gap-1 text-sm sm:hidden" aria-label={`Échéances de ${fee.name}`}>
                    {fee.installments.map((row) => (
                        <li key={row.id} className="flex flex-wrap justify-between gap-x-3 border-t border-[var(--eduflow-border-subtle)] py-1">
                            <span>
                                {formatShortDate(row.dueDate)} · <span className="tabular-nums">{formatFcfa(row.amount)}</span>
                            </span>
                            <span className="font-medium">{installmentState(row)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {fee.installments && fee.installments.length > 0 ? (
                <div className="mt-3 hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                        <caption className="sr-only">Échéances de {fee.name}</caption>
                        <thead>
                            <tr className="text-left text-muted-foreground">
                                <th scope="col" className="py-1 pr-2 font-medium">Échéance</th>
                                <th scope="col" className="py-1 pr-2 font-medium">Montant</th>
                                <th scope="col" className="py-1 pr-2 font-medium">Couvert</th>
                                <th scope="col" className="py-1 font-medium">État</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fee.installments.map((row) => (
                                <tr key={row.id} className="border-t border-[var(--eduflow-border-subtle)]">
                                    <td className="py-1 pr-2">{formatDate(row.dueDate)}</td>
                                    <td className="py-1 pr-2 tabular-nums">{formatFcfa(row.amount)}</td>
                                    <td className="py-1 pr-2 tabular-nums">{formatFcfa(row.covered)}</td>
                                    <td className="py-1">{installmentState(row)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {fee.remaining > 0 ? (
                <div className="mt-4 border-t border-[var(--eduflow-border-subtle)] pt-3">
                    {!onlineAvailable ? (
                        <p className="text-sm text-muted-foreground">Paiement en ligne indisponible pour cet établissement : réglez à l&apos;économat.</p>
                    ) : options.maxAmount === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Un paiement de {formatFcfa(fee.reserved)} attend la confirmation du fournisseur. Rien d&apos;autre n&apos;est payable
                            pour l&apos;instant.
                        </p>
                    ) : (
                        <fieldset disabled={busy}>
                            <legend className="mb-2 text-sm font-semibold">Payer en ligne</legend>
                            {options.blockedByPending ? (
                                <p className="mb-2 text-sm text-muted-foreground">
                                    Un paiement de {formatFcfa(fee.reserved)} attend sa confirmation : vous pouvez seulement régler un montant libre
                                    jusqu&apos;à {formatFcfa(options.maxAmount)}.
                                </p>
                            ) : null}
                            <div className="grid gap-2 text-sm">
                                {options.nextInstallment ? (
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name={radioName}
                                            checked={effectiveMode === "NEXT_INSTALLMENT"}
                                            onChange={() => setMode("NEXT_INSTALLMENT")}
                                        />
                                        Échéance du {formatDate(options.nextInstallment.dueDate)} : {formatFcfa(options.nextInstallment.amount)}
                                    </label>
                                ) : null}
                                {options.fullBalance ? (
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name={radioName}
                                            checked={effectiveMode === "FULL_BALANCE"}
                                            onChange={() => setMode("FULL_BALANCE")}
                                        />
                                        Tout le solde : {formatFcfa(options.fullBalance)}
                                    </label>
                                ) : null}
                                <label className="flex items-center gap-2">
                                    <input type="radio" name={radioName} checked={effectiveMode === "AMOUNT"} onChange={() => setMode("AMOUNT")} />
                                    Autre montant
                                </label>
                                {effectiveMode === "AMOUNT" ? (
                                    <div>
                                        <label htmlFor={fieldId} className="block text-muted-foreground">
                                            Montant en FCFA (au plus {formatFcfa(options.maxAmount)})
                                        </label>
                                        <input
                                            id={fieldId}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete="off"
                                            value={amountText}
                                            onChange={(e) => setAmountText(e.target.value)}
                                            aria-invalid={freeError ? true : undefined}
                                            aria-describedby={freeError ? `${fieldId}-err` : undefined}
                                            className="mt-1 h-10 w-full max-w-xs rounded-lg border border-[var(--eduflow-border-default)] bg-transparent px-3 tabular-nums"
                                        />
                                        {freeError ? (
                                            <p id={`${fieldId}-err`} className="mt-1 text-[var(--eduflow-danger-800)]">
                                                {freeError}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    className={`${homeStyles.pill} disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={() => void pay()}
                                    disabled={!canPay}
                                >
                                    {state.kind === "submitting"
                                        ? "Préparation du paiement…"
                                        : state.kind === "redirecting"
                                          ? "Redirection vers FedaPay…"
                                          : Number.isFinite(shownAmount) && shownAmount > 0
                                            ? `Payer ${formatFcfa(shownAmount)}`
                                            : "Payer"}
                                </button>
                                <span className={homeStyles.detail}>Mobile Money via FedaPay, sur le compte de l&apos;établissement.</span>
                            </div>
                        </fieldset>
                    )}
                    {state.kind === "error" ? (
                        <p role="alert" className="mt-2 text-sm text-[var(--eduflow-danger-800)]">
                            {state.message}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}

function PaymentHistory({ payments }: { payments: ChildData["payments"] }) {
    const [receiptError, setReceiptError] = React.useState<string | null>(null);
    const [loadingId, setLoadingId] = React.useState<string | null>(null);

    const downloadReceipt = async (paymentId: string) => {
        setReceiptError(null);
        setLoadingId(paymentId);
        try {
            const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/invoice`);
            const body = (await res.json().catch(() => ({}))) as { pdf?: string; filename?: string; error?: string };
            if (!res.ok || typeof body.pdf !== "string" || !body.pdf.startsWith("data:application/pdf")) {
                setReceiptError(body.error ?? "Reçu indisponible pour le moment.");
                return;
            }
            const link = document.createElement("a");
            link.href = body.pdf;
            link.download = body.filename ?? "recu.pdf";
            link.click();
        } catch {
            setReceiptError("Connexion impossible : reçu non téléchargé.");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <Block id="child-history" title="Historique des paiements">
            {payments.length === 0 ? (
                <Empty>Aucun paiement enregistré pour cet enfant.</Empty>
            ) : (
                <ul className={homeStyles.watch}>
                    {payments.map((payment, i) => {
                        const badge = STATUS_BADGE[payment.status];
                        const waiting = payment.status === "PENDING" || payment.status === "UNDER_REVIEW";
                        return (
                            <li key={payment.id} className={homeStyles.watchItem}>
                                <span className={homeStyles.avatar} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} aria-hidden="true">
                                    {initials(payment.feeName)}
                                </span>
                                <div className="min-w-0">
                                    <div className={homeStyles.name}>
                                        {payment.feeName} · {formatFcfa(payment.amount)}
                                    </div>
                                    <div className={homeStyles.detail}>
                                        {formatDate(payment.paidAt ?? payment.date)} · {METHOD_LABELS[payment.method] ?? payment.method}
                                        {payment.reference ? ` · réf. ${payment.reference}` : ""}
                                    </div>
                                    <div className="mt-1">
                                        <Badge variant={badge.variant} size="sm">
                                            {badge.label}
                                        </Badge>
                                    </div>
                                </div>
                                {payment.receiptAvailable ? (
                                    <button
                                        type="button"
                                        className={homeStyles.pill}
                                        onClick={() => void downloadReceipt(payment.id)}
                                        disabled={loadingId === payment.id}
                                    >
                                        {loadingId === payment.id ? "Reçu…" : "Reçu"}
                                    </button>
                                ) : waiting && payment.online && payment.reference ? (
                                    <Link className={homeStyles.pill} href={`/dashboard/finance/retour-paiement?ref=${encodeURIComponent(payment.reference)}`}>
                                        Suivre
                                    </Link>
                                ) : (
                                    <span aria-hidden="true" />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {receiptError ? (
                <p role="alert" className="mt-2 text-sm text-[var(--eduflow-danger-800)]">
                    {receiptError}
                </p>
            ) : null}
        </Block>
    );
}
