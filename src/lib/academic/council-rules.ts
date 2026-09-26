/**
 * Seuils des mentions proposées au conseil de classe, réglables par école.
 *
 * Avant : écrits en dur dans l'API des conseils (16, 14, 10, 3 incidents).
 * Ces valeurs restent les défauts ; l'école les modifie dans la configuration
 * académique (ConfigOption, catégorie COUNCIL_RULES).
 */
import prisma from "@/lib/prisma";
import { z } from "zod";

export const COUNCIL_RULES_CATEGORY = "COUNCIL_RULES";
const CODE = "DEFAULT";

export const councilRulesSchema = z
    .object({
        honorMin: z.number().min(0).max(20),
        encouragementMin: z.number().min(0).max(20),
        workWarningBelow: z.number().min(0).max(20),
        conductIncidents: z.number().int().min(1).max(50),
    })
    .refine((rules) => rules.honorMin >= rules.encouragementMin, {
        message: "Le seuil du tableau d'honneur doit être au moins égal à celui des encouragements.",
        path: ["honorMin"],
    })
    .refine((rules) => rules.encouragementMin > rules.workWarningBelow, {
        message: "Le seuil des encouragements doit dépasser celui de l'avertissement.",
        path: ["encouragementMin"],
    });

export type CouncilRules = z.infer<typeof councilRulesSchema>;

export const DEFAULT_COUNCIL_RULES: CouncilRules = {
    honorMin: 16,
    encouragementMin: 14,
    workWarningBelow: 10,
    conductIncidents: 3,
};

export async function getCouncilRules(schoolId: string): Promise<CouncilRules> {
    const option = await prisma.configOption.findFirst({
        where: { schoolId, category: COUNCIL_RULES_CATEGORY, code: CODE, isActive: true },
        select: { metadata: true },
    });
    const parsed = councilRulesSchema.safeParse(option?.metadata);
    return parsed.success ? parsed.data : DEFAULT_COUNCIL_RULES;
}

export async function saveCouncilRules(schoolId: string, rules: CouncilRules): Promise<CouncilRules> {
    await prisma.configOption.upsert({
        where: { schoolId_category_code: { schoolId, category: COUNCIL_RULES_CATEGORY, code: CODE } },
        create: {
            schoolId,
            category: COUNCIL_RULES_CATEGORY,
            code: CODE,
            label: "Mentions du conseil de classe",
            metadata: rules,
        },
        update: { metadata: rules, isActive: true },
    });
    return rules;
}

export type CouncilDecision =
    | "Tableau d'honneur"
    | "Encouragements"
    | "Aucune"
    | "Avertissement travail"
    | "Avertissement conduite";
export type CouncilDecisionVariant = "success" | "info" | "neutral" | "warning" | "danger";

export function pickDecision(
    avg: number | null,
    incidents: number,
    rules: CouncilRules = DEFAULT_COUNCIL_RULES,
): { decision: CouncilDecision; variant: CouncilDecisionVariant } {
    if (incidents >= rules.conductIncidents) return { decision: "Avertissement conduite", variant: "danger" };
    if (avg === null) return { decision: "Aucune", variant: "neutral" };
    if (avg >= rules.honorMin) return { decision: "Tableau d'honneur", variant: "success" };
    if (avg >= rules.encouragementMin) return { decision: "Encouragements", variant: "info" };
    if (avg < rules.workWarningBelow) return { decision: "Avertissement travail", variant: "warning" };
    return { decision: "Aucune", variant: "neutral" };
}
