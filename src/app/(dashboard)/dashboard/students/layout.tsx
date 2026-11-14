import { FinanceSchoolGate } from "@/components/finance/finance-school-gate";

/** S6 : école sélectionnée obligatoire avant d'afficher des élèves (super-admin). */
export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <FinanceSchoolGate description="Les dossiers des élèves appartiennent à chaque école. Sélectionnez celle que vous voulez consulter : les élèves de plusieurs établissements ne sont jamais mélangés.">
            {children}
        </FinanceSchoolGate>
    );
}
