"use client";

import { useState, useEffect } from "react";
import { Avatar, Badge, Card, Icon, Spinner, type IconName } from "@/components/edu";
import {
    type Student,
    type EvaluationData,
    type ScoreVariant,
    pickScoreVariant,
    variantToken,
} from "./types";

// Extrait de dashboard/grades/cahier/page.tsx (1349 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

export function ExpandedEvalGrades({
    ev,
    students,
}: {
    ev: EvaluationData;
    students: Student[];
}) {
    const avgVariant = pickScoreVariant(ev.stats.average, ev.maxGrade);
    return (
        <div
            style={{
                background: "var(--eduflow-surface-sunken)",
                borderTop: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            <div
                className="flex flex-wrap items-center gap-5 border-b px-5 py-2"
                style={{
                    fontSize: 11,
                    color: "var(--eduflow-text-secondary)",
                    borderColor: "var(--eduflow-border-subtle)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <span className="flex items-center gap-1.5">
                    <Icon name="arrowUp" size={11} color="var(--eduflow-success-700)" />
                    Max ·{" "}
                    <b className="eduflow-tabular" style={{ marginLeft: 2 }}>
                        {ev.stats.max !== null ? ev.stats.max : "—"}
                    </b>
                </span>
                <span className="flex items-center gap-1.5">
                    <Icon name="chart" size={11} color={variantToken(avgVariant, 600)} />
                    Moy. ·{" "}
                    <b
                        className="eduflow-tabular"
                        style={{ marginLeft: 2, color: variantToken(avgVariant, 700) }}
                    >
                        {ev.stats.average !== null
                            ? ev.stats.average.toFixed(2).replace(".", ",")
                            : "—"}
                    </b>
                </span>
                <span className="flex items-center gap-1.5">
                    <Icon name="arrowDown" size={11} color="var(--eduflow-danger-700)" />
                    Min ·{" "}
                    <b className="eduflow-tabular" style={{ marginLeft: 2 }}>
                        {ev.stats.min !== null ? ev.stats.min : "—"}
                    </b>
                </span>
            </div>
            <div className="overflow-x-auto">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: "var(--eduflow-surface-card)", textAlign: "left" }}>
                            <Th width={50}>#</Th>
                            <Th>Élève</Th>
                            <Th width={120}>Matricule</Th>
                            <Th width={120} center>
                                Note /{ev.maxGrade}
                            </Th>
                            <Th width={90} center>
                                Statut
                            </Th>
                            <Th>Commentaire</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((stu, idx) => {
                            const grade = ev.grades[stu.id];
                            const cellVariant = pickScoreVariant(
                                grade?.value ?? null,
                                ev.maxGrade
                            );
                            return (
                                <tr
                                    key={stu.id}
                                    style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}
                                >
                                    <Td style={{ color: "var(--eduflow-text-tertiary)" }}>{idx + 1}</Td>
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            <Avatar
                                                name={`${stu.firstName} ${stu.lastName}`}
                                                size="xs"
                                            />
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                {stu.lastName} {stu.firstName}
                                            </span>
                                        </div>
                                    </Td>
                                    <Td className="eduflow-mono" style={{ fontSize: 11 }}>
                                        {stu.matricule}
                                    </Td>
                                    <Td center>
                                        {grade ? (
                                            grade.isAbsent ? (
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontStyle: "italic",
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    ABS
                                                </span>
                                            ) : grade.value !== null ? (
                                                <span
                                                    className="eduflow-tabular inline-flex items-center justify-center"
                                                    style={{
                                                        minWidth: 56,
                                                        padding: "2px 10px",
                                                        borderRadius: 8,
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        background: variantToken(cellVariant, 50),
                                                        color: variantToken(cellVariant, 700),
                                                    }}
                                                >
                                                    {grade.value.toString().replace(".", ",")}
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                    —
                                                </span>
                                            )
                                        ) : (
                                            <span style={{ color: "var(--eduflow-text-tertiary)" }}>—</span>
                                        )}
                                    </Td>
                                    <Td center>
                                        {grade?.isAbsent ? (
                                            <Badge variant="danger" size="sm">
                                                {grade.isExcused ? "ABS-J" : "ABS-NJ"}
                                            </Badge>
                                        ) : grade?.value !== null && grade?.value !== undefined ? (
                                            <Badge variant="success" size="sm" icon="check">
                                                Noté
                                            </Badge>
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                —
                                            </span>
                                        )}
                                    </Td>
                                    <Td>
                                        {grade?.comment ? (
                                            <span
                                                className="block truncate"
                                                style={{
                                                    maxWidth: 240,
                                                    fontSize: 12,
                                                    fontStyle: "italic",
                                                    color: "var(--eduflow-text-secondary)",
                                                }}
                                            >
                                                {grade.comment}
                                            </span>
                                        ) : null}
                                    </Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon: IconName }[];
}) {
    return (
        <div
            className="flex gap-1 rounded-md p-1"
            style={{
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active ? "var(--eduflow-surface-card)" : "transparent",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            color: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-text-secondary)",
                            boxShadow: active ? "var(--eduflow-shadow-sm)" : "none",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <Icon name={opt.icon} size={13} />
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

export function FieldSelect({
    label,
    required,
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}{" "}
                {required ? <span style={{ color: "var(--eduflow-danger-600)" }}>*</span> : null}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value ? 600 : 500,
                    color: value
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function FieldSearch({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <div
                className="flex h-[38px] items-center gap-2 px-3"
                style={{
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <Icon name="search" size={14} color="var(--eduflow-text-tertiary)" />
                <input
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
                    className="flex-1 bg-transparent outline-none"
                    style={{
                        border: 0,
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "var(--eduflow-text-primary)",
                    }}
                />
            </div>
        </label>
    );
}

export function EmptyHero({
    icon,
    title,
    body,
}: {
    icon: IconName;
    title: string;
    body: string;
}) {
    return (
        <Card padding={36}>
            <div className="flex flex-col items-center gap-3 text-center">
                <div
                    className="grid place-items-center"
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: 16,
                        background: "var(--brand-50)",
                    }}
                >
                    <Icon name={icon} size={26} color="var(--brand-700)" />
                </div>
                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                    {title}
                </h3>
                <p
                    style={{
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        maxWidth: 480,
                        lineHeight: 1.55,
                        margin: 0,
                    }}
                >
                    {body}
                </p>
            </div>
        </Card>
    );
}

export function Th({
    children,
    width,
    center,
    sticky,
    stickyLeft,
    accent,
}: {
    children: React.ReactNode;
    width?: number;
    center?: boolean;
    sticky?: boolean;
    stickyLeft?: number;
    accent?: boolean;
}) {
    return (
        <th
            style={{
                padding: "10px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                width,
                textAlign: center ? "center" : "left",
                position: sticky ? "sticky" : undefined,
                left: sticky ? stickyLeft ?? 0 : undefined,
                background: sticky
                    ? "var(--eduflow-surface-sunken)"
                    : accent
                    ? "var(--brand-50)"
                    : undefined,
                zIndex: sticky ? 1 : undefined,
            }}
        >
            {children}
        </th>
    );
}

export function Td({
    children,
    style,
    center,
    sticky,
    stickyLeft,
    className,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    center?: boolean;
    sticky?: boolean;
    stickyLeft?: number;
    className?: string;
}) {
    return (
        <td
            className={className}
            style={{
                padding: "10px 16px",
                fontSize: 13,
                textAlign: center ? "center" : "left",
                position: sticky ? "sticky" : undefined,
                left: sticky ? stickyLeft ?? 0 : undefined,
                background: sticky ? "var(--eduflow-surface-card)" : undefined,
                zIndex: sticky ? 1 : undefined,
                ...style,
            }}
        >
            {children}
        </td>
    );
}
