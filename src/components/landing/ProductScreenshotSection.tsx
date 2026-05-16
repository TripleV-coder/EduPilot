"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
    BarChart,
    Button,
    Card,
    MetricCard,
} from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";

const PREVIEW_TREND = [
    { label: "CI-CP", compare: 88, value: 94 },
    { label: "CE1-CE2", compare: 76, value: 86 },
    { label: "CM1-CM2", compare: 82, value: 89 },
    { label: "6ᵉ-5ᵉ", compare: 70, value: 82 },
    { label: "4ᵉ-3ᵉ", compare: 68, value: 78 },
    { label: "2nde", compare: 72, value: 80 },
    { label: "1ʳᵉ", compare: 74, value: 81 },
    { label: "Term", compare: 80, value: 86 },
];

const PROOF = [
    { value: "+ 38%", label: "de recouvrement à T+90j" },
    { value: "6 h", label: "gagnées / sem. par enseignant" },
    { value: "94%", label: "des parents lisent les SMS" },
    { value: "< 200 ms", label: "temps de réponse moyen" },
];

/**
 * Product screenshot block matching the v3 landing.
 * Window-chrome card with a mini director-dashboard preview, plus a row of
 * 4 proof stats underneath.
 */
export function ProductScreenshotSection() {
    return (
        <section className="eduflow-scope relative px-6 pb-20" style={{ background: "var(--eduflow-surface-page)" }}>
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
                style={{
                    maxWidth: 1100,
                    margin: "0 auto",
                    borderRadius: "var(--eduflow-radius-card)",
                    overflow: "hidden",
                    boxShadow: "var(--eduflow-shadow-overlay)",
                    border: "1px solid var(--eduflow-border-subtle)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <div
                    style={{
                        height: 36,
                        padding: "0 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "var(--eduflow-neutral-100)",
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                    }}
                    aria-hidden
                >
                    {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                        <span
                            key={c}
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                background: c,
                            }}
                        />
                    ))}
                    <div
                        style={{
                            flex: 1,
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            fontFamily: "var(--eduflow-font-mono)",
                        }}
                    >
                        app.edupilot.bj/dashboard
                    </div>
                </div>

                <div
                    style={{
                        padding: "clamp(16px, 3vw, 24px)",
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 12,
                        gridAutoRows: "min-content",
                    }}
                >
                    <MetricCard
                        label="Élèves actifs"
                        value="1 248"
                        trend={4.2}
                        icon="users"
                        variant="brand"
                    />
                    <MetricCard
                        label="Recouvrement"
                        value="82"
                        unit="%"
                        trend={6.1}
                        icon="money"
                        variant="success"
                    />
                    <MetricCard
                        label="Présence"
                        value="92,4"
                        unit="%"
                        trend={-1.3}
                        icon="check"
                        variant="info"
                    />
                    <MetricCard
                        label="Incidents"
                        value="2"
                        trend={-50}
                        icon="warning"
                        variant="warning"
                    />
                    <Card style={{ gridColumn: "span 3" }}>
                        <SubLabel>Recouvrement T2 · objectif 95%</SubLabel>
                        <BarChart data={PREVIEW_TREND} height={120} max={100} />
                    </Card>
                    <Card>
                        <SubLabel>Insight IA</SubLabel>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                lineHeight: 1.35,
                                marginTop: 6,
                            }}
                        >
                            3 élèves de 3ᵉ A en décrochage en algèbre.
                        </div>
                        <Button
                            variant="soft"
                            size="sm"
                            iconRight="arrowRight"
                            style={{ marginTop: 10 }}
                        >
                            Voir
                        </Button>
                    </Card>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{
                    maxWidth: 1100,
                    margin: "24px auto 0",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                }}
            >
                {PROOF.map((s) => (
                    <Card key={s.label}>
                        <div
                            className="eduflow-display eduflow-tabular"
                            style={{
                                fontSize: 30,
                                fontWeight: 700,
                                color: "var(--brand-700)",
                                letterSpacing: "-0.03em",
                            }}
                        >
                            {s.value}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                                lineHeight: 1.4,
                            }}
                        >
                            {s.label}
                        </div>
                    </Card>
                ))}
            </motion.div>
        </section>
    );
}
