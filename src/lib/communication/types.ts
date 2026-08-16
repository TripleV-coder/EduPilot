import type { Prisma } from "@prisma/client";

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
export type CommunicationType = 'TRANSACTIONAL' | 'MARKETING' | 'ALERT';

export interface SendMessageOptions {
    recipient: string; // email or phone
    channel: CommunicationChannel;
    content: string;
    subject?: string;
    templateId?: string;
    variables?: Record<string, string>;
    userId?: string;
    schoolId: string;
    type?: CommunicationType; // Default: TRANSACTIONAL
    metadata?: Prisma.InputJsonValue;
}

export interface CommunicationResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
