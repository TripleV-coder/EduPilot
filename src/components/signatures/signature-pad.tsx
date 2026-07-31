"use client";

import { useEffect, useRef, useState } from "react";

export interface SignatureValue {
    method: "DRAWN" | "TYPED";
    signatureData: string;
}

/**
 * Capture d'une signature : tracé manuscrit (canvas) ou nom saisi.
 * Émet la valeur courante (ou null si vide) via `onChange`.
 */
export function SignaturePad({ onChange }: { onChange: (v: SignatureValue | null) => void }) {
    const [mode, setMode] = useState<"DRAWN" | "TYPED">("DRAWN");
    const [typed, setTyped] = useState("");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasStroke = useRef(false);

    useEffect(() => {
        if (mode === "TYPED") {
            onChange(typed.trim() ? { method: "TYPED", signatureData: typed.trim() } : null);
        }
    }, [typed, mode, onChange]);

    function ctx() {
        return canvasRef.current?.getContext("2d") ?? null;
    }

    function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const c = ctx();
        if (!c) return;
        const { x, y } = pointerPos(e);
        c.beginPath();
        c.moveTo(x, y);
    }

    function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawing.current) return;
        const c = ctx();
        if (!c) return;
        const { x, y } = pointerPos(e);
        c.lineWidth = 2;
        c.lineCap = "round";
        c.strokeStyle = "#111";
        c.lineTo(x, y);
        c.stroke();
        hasStroke.current = true;
    }

    function endDraw() {
        if (!drawing.current) return;
        drawing.current = false;
        if (hasStroke.current && canvasRef.current) {
            onChange({ method: "DRAWN", signatureData: canvasRef.current.toDataURL("image/png") });
        }
    }

    function clear() {
        const c = ctx();
        if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        hasStroke.current = false;
        onChange(null);
    }

    return (
        <div>
            <div className="mb-2 flex gap-1">
                <ModeButton active={mode === "DRAWN"} onClick={() => { setMode("DRAWN"); onChange(null); }}>Dessiner</ModeButton>
                <ModeButton active={mode === "TYPED"} onClick={() => { setMode("TYPED"); clear(); }}>Saisir</ModeButton>
            </div>

            {mode === "DRAWN" ? (
                <div>
                    <canvas
                        ref={canvasRef}
                        width={360}
                        height={120}
                        onPointerDown={startDraw}
                        onPointerMove={moveDraw}
                        onPointerUp={endDraw}
                        onPointerLeave={endDraw}
                        style={{
                            width: "100%",
                            maxWidth: 360,
                            height: 120,
                            borderRadius: 10,
                            border: "1px dashed var(--eduflow-border-default)",
                            background: "var(--eduflow-surface-card)",
                            touchAction: "none",
                            cursor: "crosshair",
                        }}
                    />
                    <button type="button" onClick={clear} style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "var(--eduflow-text-tertiary)" }}>
                        Effacer
                    </button>
                </div>
            ) : (
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Tape ton nom complet"
                    maxLength={120}
                    style={{
                        width: "100%",
                        maxWidth: 360,
                        height: 44,
                        padding: "0 14px",
                        borderRadius: 10,
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        fontFamily: "cursive",
                        fontSize: 20,
                        color: "var(--eduflow-text-primary)",
                    }}
                />
            )}
        </div>
    );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 8,
                border: active ? "1px solid var(--brand-600)" : "1px solid var(--eduflow-border-default)",
                background: active ? "var(--brand-50)" : "var(--eduflow-surface-card)",
                color: active ? "var(--brand-700)" : "var(--eduflow-text-secondary)",
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}
