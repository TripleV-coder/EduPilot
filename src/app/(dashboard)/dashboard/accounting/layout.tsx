import { FinanceSchoolGate } from "@/components/finance/finance-school-gate";

/** S6 : école sélectionnée obligatoire avant tout affichage financier (super-admin). */
export default function Layout({ children }: { children: React.ReactNode }) {
    return <FinanceSchoolGate>{children}</FinanceSchoolGate>;
}
