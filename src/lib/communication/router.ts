import { prisma } from "@/lib/prisma";
import { SendMessageOptions, CommunicationResult } from "./types";
import { logger } from "@/lib/utils/logger";

export class MessageRouterService {

    /**
     * Send a message through the appropriate channel
     */
    async sendMessage(options: SendMessageOptions): Promise<CommunicationResult> {
        const { recipient, channel, content, schoolId, userId, type, subject, metadata } = options;

        logger.info(`Routing message [${channel}] to ${recipient}: ${type}`);

        try {
            // 1. Log the attempt
            const log = await prisma.communicationLog.create({
                data: {
                    schoolId,
                    userId,
                    recipient,
                    channel,
                    type: type || "TRANSACTIONAL",
                    status: "PENDING",
                    metadata: metadata || {},
                },
            });

            // 2. Mock Provider Dispatch (Replace with real providers later)
            // In a real scenario, this would switch/case on channel and call SendGrid, Twilio, etc.
            await this.simulateProviderDelay();

            // 3. Update Log
            await prisma.communicationLog.update({
                where: { id: log.id },
                data: { status: "SENT" },
            });

            logger.info(`Message sent successfully: ${log.id}`);
            return { success: true, messageId: log.id };

        } catch (error) {
            logger.error(`Failed to send message: ${error}`);

            // Log failure if possible (might fail if DB is down, but we try)
            try {
                await prisma.communicationLog.create({
                    data: {
                        schoolId,
                        userId,
                        recipient,
                        channel,
                        type: type || "TRANSACTIONAL",
                        status: "FAILED",
                        error: error instanceof Error ? error.message : "Unknown error",
                        metadata: metadata || {},
                    },
                });
            } catch (logError) {
                console.error("Critical: Failed to log failure", logError);
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    private async simulateProviderDelay() {
        return new Promise(resolve => setTimeout(resolve, 500));
    }
}

export const messageRouter = new MessageRouterService();
