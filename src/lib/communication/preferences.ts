import prisma from "@/lib/prisma";

export const DEFAULT_CHANNELS = ["EMAIL"];

export class CommunicationPreferencesService {
    /**
     * Get preferences for a user, creating defaults if they don't exist
     */
    async getUserPreferences(userId: string) {
        let prefs = await (prisma as any).communicationPreference.findUnique({
            where: { userId },
        });

        if (!prefs) {
            prefs = await (prisma as any).communicationPreference.create({
                data: {
                    userId,
                    channels: DEFAULT_CHANNELS,
                    language: "fr",
                },
            });
        }

        return prefs;
    }

    /**
     * Update preferences for a user
     */
    async updatePreferences(userId: string, data: {
        channels?: string[];
        language?: string;
        quietHoursStart?: string | null;
        quietHoursEnd?: string | null;
    }) {
        return (prisma as any).communicationPreference.upsert({
            where: { userId },
            create: {
                userId,
                channels: data.channels || DEFAULT_CHANNELS,
                language: data.language || "fr",
                quietHoursStart: data.quietHoursStart,
                quietHoursEnd: data.quietHoursEnd,
            },
            update: {
                channels: data.channels,
                language: data.language,
                quietHoursStart: data.quietHoursStart,
                quietHoursEnd: data.quietHoursEnd,
            },
        });
    }

    /**
     * Check if a channel is enabled for a user
     */
    async isChannelEnabled(userId: string, channel: string): Promise<boolean> {
        const prefs = await this.getUserPreferences(userId);
        return prefs.channels.includes(channel);
    }
}

export const commPreferences = new CommunicationPreferencesService();
