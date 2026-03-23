import prisma from "@/lib/prisma";
import { SendMessageOptions, CommunicationResult } from "./types";
import { logger } from "@/lib/utils/logger";

export class MessageRouterService {

    /**
     * Send a message through the appropriate channel
     */
    async sendMessage(options: SendMessageOptions): Promise<CommunicationResult> {
        const { recipient, channel, schoolId, userId, type, metadata } = options;

        logger.info(`Routing message [${channel}] to ${recipient}: ${type}`);

        try {
            // 1. Log the attempt
            const log = await (prisma as any).communicationLog.create({
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

            // 2. Provider Dispatch (strict production mode)
            await this.dispatchViaProvider(channel, recipient);

            // 3. Update Log
            await (prisma as any).communicationLog.update({
                where: { id: log.id },
                data: { status: "SENT" },
            });

            logger.info(`Message sent successfully: ${log.id}`);
            return { success: true, messageId: log.id };

        } catch (error) {
            logger.error(`Failed to send message: ${error}`);

            // Log failure if possible (might fail if DB is down, but we try)
            try {
                await (prisma as any).communicationLog.create({
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
                logger.error("Critical: Failed to log failure", logError instanceof Error ? logError : new Error(String(logError)), { module: "communication/router" });
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    private async dispatchViaProvider(
        channel: SendMessageOptions["channel"],
        recipient: string
    ): Promise<void> {
        const providerEnabled = process.env.COMMUNICATION_PROVIDER_ENABLED === "true";
        if (!providerEnabled) {
            throw new Error(`Provider non configuré pour le canal ${channel}.`);
        }

        // NOTE: The concrete provider integration (SendGrid/Twilio/WhatsApp) is intentionally explicit.
        // We fail fast in production rather than simulating a successful send.
        throw new Error(`Canal ${channel} non implémenté pour ${recipient}.`);
    }
}

export const messageRouter = new MessageRouterService();
