import { AutomationService } from "../src/lib/services/automation.service";
import { PrismaClient } from "@prisma/client";

// Set up globals needed for the service if any, or just instantiate
async function main() {
    console.log("🛠 Starting CLI Maintenance Script...");
    
    const automationService = new AutomationService();
    const result = await automationService.runDailyMaintenance();
    
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
