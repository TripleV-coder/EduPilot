/**
 * External AI APIs Client (couche 3 — optionnelle)
 * Groq, Google Gemini, OpenAI, Anthropic en cascade best-effort.
 * Sans clé configurée, le routeur bascule sur les gabarits locaux.
 */

import { logger } from '@/lib/utils/logger';
import { fetchJsonWithPolicy } from "@/lib/ai/http-client";

export interface ExternalAIRequest {
  message: string;
  role: string;
  schoolName?: string;
  studentData?: Record<string, unknown>;
  language?: 'fr' | 'en';
  maxTokens?: number;
  temperature?: number;
}

// Formes minimales des réponses des fournisseurs (champs réellement lus)
interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
interface AnthropicMessageResponse {
  content?: Array<{ text?: string }>;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}
interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface ExternalAIResponse {
  success: boolean;
  response: string;
  provider: 'groq' | 'openai' | 'anthropic' | 'google' | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// =====================
// Groq Client (gratuit, optionnel)
// =====================

async function callGroq(request: ExternalAIRequest): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = buildEduPilotSystemPrompt(
      request.role,
      request.schoolName,
      request.studentData,
      request.language
    );

    const result = await fetchJsonWithPolicy<GroqChatResponse>(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: request.message },
          ],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        },
        timeoutMs: 18_000,
        retries: 1,
      }
    );

    if (!result.ok) {
      logger.warn("Groq API error", { status: result.status, error: result.error });
      return null;
    }

    return result.data.choices?.[0]?.message?.content || null;
  } catch (error) {
    logger.error("Groq API call failed", { error });
    return null;
  }
}

// =====================
// OpenAI Client
// =====================

function sanitizeStudentDataForExternalAI(
  studentData: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!studentData) return undefined;

  const forbiddenKeys = new Set([
    "id",
    "userId",
    "studentId",
    "email",
    "phone",
    "address",
    "firstName",
    "lastName",
    "fullName",
    "matricule",
    "nationalId",
    "passportNumber",
  ]);

  const recurse = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(recurse);
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        if (forbiddenKeys.has(key)) continue;
        result[key] = recurse(val);
      }
      return result;
    }
    return value;
  };

  return recurse(studentData) as Record<string, unknown>;
}

async function callOpenAI(request: ExternalAIRequest): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = buildEduPilotSystemPrompt(
      request.role,
      request.schoolName,
      request.studentData,
      request.language
    );

    const result = await fetchJsonWithPolicy<OpenAIChatResponse>('https://api.openai.com/v1/chat/completions', {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.message }
        ],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      },
      timeoutMs: 18_000,
      retries: 1,
    });

    if (!result.ok) {
      logger.warn('OpenAI API error', { status: result.status, error: result.error });
      return null;
    }

    return result.data.choices?.[0]?.message?.content || null;
  } catch (error) {
    logger.error('OpenAI API call failed', { error });
    return null;
  }
}

// =====================
// Anthropic Client
// =====================

async function callAnthropic(request: ExternalAIRequest): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = buildEduPilotSystemPrompt(
      request.role,
      request.schoolName,
      request.studentData,
      request.language
    );

    const result = await fetchJsonWithPolicy<AnthropicMessageResponse>('https://api.anthropic.com/v1/messages', {
      method: "POST",
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: 'claude-3-haiku-20240307',
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: request.message }
        ],
      },
      timeoutMs: 18_000,
      retries: 1,
    });

    if (!result.ok) {
      logger.warn('Anthropic API error', { status: result.status, error: result.error });
      return null;
    }

    return result.data.content?.[0]?.text || null;
  } catch (error) {
    logger.error('Anthropic API call failed', { error });
    return null;
  }
}

// =====================
// Google Gemini Client
// =====================

async function callGoogleGemini(
  request: ExternalAIRequest
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = buildEduPilotSystemPrompt(
      request.role,
      request.schoolName,
      request.studentData,
      request.language
    );

    const result = await fetchJsonWithPolicy<GeminiResponse>(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      body: {
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUser: ${request.message}`
          }]
        }],
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 1000,
        }
      },
      timeoutMs: 18_000,
      retries: 1,
    });

    if (!result.ok) {
      logger.warn('Google Gemini API error', { status: result.status, error: result.error });
      return null;
    }

    return result.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    logger.error('Google Gemini API call failed', { error });
    return null;
  }
}

// =====================
// System Prompt Builder
// =====================

function buildEduPilotSystemPrompt(
  role: string,
  schoolName?: string,
  studentData?: Record<string, unknown>,
  language: 'fr' | 'en' = 'fr'
): string {
  const lang = language === 'fr' ? 'français' : 'english';

  const safeStudentData = sanitizeStudentDataForExternalAI(studentData);

  const prompt = `You are EduPilot AI, an intelligent assistant for the EduPilot school management platform.

You are helping a user with role: ${role}
${schoolName ? `School: ${schoolName}` : ''}
${safeStudentData ? `Context (anonymized, no PII): ${JSON.stringify(safeStudentData)}` : ''}

Respond in ${lang}. Be helpful, professional, and context-aware.

Key capabilities:
- Academic performance analysis
- Attendance tracking
- Financial management
- Schedule management
- Student risk prediction
- Report generation
- Educational guidance

Keep responses clear and actionable. If you don't have specific data, acknowledge limitations.`;

  return prompt;
}

// =====================
// Main External AI Function
// =====================

export async function callExternalAI(request: ExternalAIRequest): Promise<ExternalAIResponse> {
  const configured = process.env.AI_PROVIDER?.split(",").map((p) => p.trim()).filter(Boolean);
  const providers = configured?.length ? configured : ["groq", "google"];

  for (const provider of providers) {
    let response: string | null = null;

    switch (provider.trim()) {
      case "groq":
        response = await callGroq(request);
        if (response) {
          return { success: true, response, provider: "groq" };
        }
        break;

      case "openai":
        response = await callOpenAI(request);
        if (response) {
          return { success: true, response, provider: 'openai' };
        }
        break;

      case 'anthropic':
        response = await callAnthropic(request);
        if (response) {
          return { success: true, response, provider: 'anthropic' };
        }
        break;

      case 'google':
        response = await callGoogleGemini(request);
        if (response) {
          return { success: true, response, provider: 'google' };
        }
        break;
    }
  }

  return { success: false, response: '', provider: null };
}

// =====================
// Availability Check
// =====================

export async function isExternalAIAvailable(): Promise<boolean> {
  const providers = ["groq", "openai", "anthropic", "google"] as const;
  const envVars = ["GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_AI_API_KEY"] as const;

  for (let i = 0; i < providers.length; i++) {
    if (process.env[envVars[i]]) {
      try {
        switch (providers[i]) {
          case "groq": {
            const groqResponse = await fetch("https://api.groq.com/openai/v1/models", {
              headers: { Authorization: `Bearer ${process.env[envVars[i]]}` },
            });
            if (groqResponse.ok) return true;
            break;
          }
          case "openai":
            const openaiResponse = await fetch('https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${process.env[envVars[i]]}` }
            });
            if (openaiResponse.ok) return true;
            break;

          case 'anthropic':
            const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': process.env[envVars[i]]!,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [] })
            });
            if (anthropicResponse.status !== 401) return true;
            break;

          case 'google':
            const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env[envVars[i]]}`);
            if (googleResponse.ok) return true;
            break;
        }
      } catch {
        // Continue to next provider
      }
    }
  }

  return false;
}