import type { Metadata } from "next";
import { DesignSystemShowcase } from "./showcase";

export const metadata: Metadata = {
    title: "Design System v2 · 2026",
    description:
        "EduPilot — système de design Sky → Indigo. Tokens, fondations, composants Edu.",
};

export default function DesignSystemPage() {
    return <DesignSystemShowcase />;
}
