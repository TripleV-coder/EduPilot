import { AutomationService } from "../src/lib/services/automation.service";
import { acquireJobLease, releaseJobLease } from "../src/lib/system/job-lease";
import { PrismaClient } from "@prisma/client";

// Set up globals needed for the service if any, or just instantiate
async function main() {
    console.log("🛠 Starting CLI Maintenance Script...");
    
    // Même bail que le cron (audit N8) : jamais deux maintenances simultanées.
    const token = await acquireJobLease("daily-maintenance", 60 * 60 * 1000);
    if (!token) {
        console.error("⏳ Une maintenance est déjà en cours (bail détenu) : abandon.");
        process.exit(1);
    }

    let result;
    try {
        const automationService = new AutomationService();
        result = await automationService.runDailyMaintenance();
    } finally {
        await releaseJobLease("daily-maintenance", token);
    }

    if (result.success) {
        console.log("✅ Maintenance successful!");
        console.log("📊 Results:", JSON.stringify(result, null, 2));
    } else {
        console.error("❌ Maintenance failed:", result.error);
        process.exit(1);
    }
}

main()
    .catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
