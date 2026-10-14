import { MaintenanceScreen } from "@/components/system/maintenance-screen";
import { getMaintenanceState } from "@/lib/system/maintenance";

/** Page affichée quand le proxy redirige un rôle bloqué pendant la maintenance. */
export default async function MaintenancePage() {
    const state = await getMaintenanceState();
    return <MaintenanceScreen message={state.message} />;
}
