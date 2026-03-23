/**
 * Ollama LLM Client — Direct Integration
 * Calls Ollama directly (without n8n intermediary) for natural language chat.
 * Returns null when Ollama is unavailable.
 */

import { logger } from '@/lib/utils/logger';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

export interface LLMChatOptions {
    message: string;
    role: string;
    schoolName?: string;
    studentData?: Record<string, any>;
    language?: 'fr' | 'en';
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Chat with Ollama LLM directly
 */
export async function chatWithLLM(options: LLMChatOptions): Promise<string | null> {
    const { message, role, schoolName, studentData, language = 'fr' } = options;

    const systemPrompt = buildSystemPrompt(role, schoolName, studentData, language);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message },
                ],
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: 500,
                },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            logger.warn('Ollama returned non-OK status', {
                module: 'llm-client',
                status: response.status,
            });
            return null;
        }

        const data = await response.json();
        return data.message?.content || null;
    } catch (error) {
        logger.warn('Failed to contact Ollama', {
            module: 'llm-client',
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Generate embeddings via Ollama
 */
export async function generateEmbeddings(text: string): Promise<number[] | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: text,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        return data.embedding || null;
    } catch {
        return null;
    }
}

/**
 * Build the system prompt based on user context
 */
function buildSystemPrompt(
    role: string,
    schoolName?: string,
    studentData?: Record<string, any>,
    language: string = 'fr'
): string {
    const lang = language === 'fr'
        ? 'Tu parles en français.'
        : 'You speak in English.';

    const roleDescriptions: Record<string, string> = {
        SUPER_ADMIN: 'un super administrateur du système',
        SCHOOL_ADMIN: 'un administrateur d\'établissement scolaire',
        DIRECTOR: 'un directeur d\'école',
        TEACHER: 'un enseignant',
        STUDENT: 'un élève',
        PARENT: 'un parent d\'élève',
        ACCOUNTANT: 'un comptable de l\'école',
        PUBLIC: 'un visiteur qui découvre la plateforme',
    };

    const roleDesc = roleDescriptions[role] || `un utilisateur avec le rôle ${role}`;

    let prompt = `Tu es EduPilot AI, l'assistant intelligent d'une plateforme de gestion scolaire au Bénin.
${lang}
Tu aides ${roleDesc}.
${schoolName ? `Établissement: ${schoolName}.` : ''}

Tu es expert en:
- Gestion scolaire (notes, présences, bulletins)
- Système éducatif béninois (séries du bac: A, C, D, E, F, G, TI)
- Finance scolaire (frais, bourses, paiements)
- Prédictions IA (risque d'échec, tendances de notes)
- Orientation scolaire

Règles:
- Sois concis et professionnel
- Utilise le markdown pour formater tes réponses
- Ne fais pas d'affirmations sans fondement
- Oriente vers les fonctionnalités EduPilot quand c'est pertinent
- Réfère aux pages du dashboard quand approprié`;

    if (studentData) {
        prompt += `\n\nDonnées contextuelles de l'élève:\n${JSON.stringify(studentData, null, 2)}`;
    }

    return prompt;
}
