/**
 * Local LLM client disabled.
 * EduPilot runs in cloud-only AI mode (Google AI providers + n8n).
 */

import { logger } from '@/lib/utils/logger';

const LOCAL_LLM_DISABLED = true;

export interface LLMChatOptions {
    message: string;
    role: string;
    schoolName?: string;
    studentData?: Record<string, any>;
    language?: 'fr' | 'en';
}

/**
 * Local LLM execution is disabled by design.
 */
export async function isOllamaAvailable(): Promise<boolean> {
    return !LOCAL_LLM_DISABLED;
}

/**
 * Local chat is disabled in cloud-only mode.
 */
export async function chatWithLLM(options: LLMChatOptions): Promise<string | null> {
    logger.warn('Local LLM request blocked: cloud-only mode enabled', {
        module: 'llm-client',
        role: options.role,
    });
    return null;
}

/**
 * Local embeddings are disabled in cloud-only mode.
 */
export async function generateEmbeddings(text: string): Promise<number[] | null> {
    logger.warn('Local embeddings request blocked: cloud-only mode enabled', {
        module: 'llm-client',
        textLength: text.length,
    });
    return null;
}

