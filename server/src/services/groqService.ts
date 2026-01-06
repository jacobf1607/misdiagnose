/**
 * Groq Service - Ultra-fast inference using Groq's LPU
 *
 * Uses OpenAI-compatible API with Groq's endpoint.
 * Primary model: GPT-OSS-20B (1000 tokens/sec)
 */

import OpenAI from 'openai';

// Initialize Groq client using OpenAI SDK (Groq is OpenAI-compatible)
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// Available Groq models
// Note: GPT-OSS models are reasoning models that output chain-of-thought,
// which doesn't work well for direct response tasks. Use Llama for those.
export const GROQ_MODELS = {
  // Ultra-fast: 560 tokens/sec - for real-time direct response tasks
  // Llama 3.1 8B is better for roleplay/chat since it gives direct answers
  FAST: 'llama-3.1-8b-instant',

  // High quality: 500 tokens/sec - for complex reasoning (GPT-OSS-120B)
  // Good for scoring/evaluation where chain-of-thought helps
  SMART: 'openai/gpt-oss-120b',

  // Alternative: 280 tokens/sec - good all-rounder
  BALANCED: 'llama-3.3-70b-versatile',
} as const;

export type GroqModel = typeof GROQ_MODELS[keyof typeof GROQ_MODELS];

/**
 * Check if Groq is available
 */
export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Generate a chat completion using Groq
 */
export async function groqChatCompletion(params: {
  model?: GroqModel;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const {
    model = GROQ_MODELS.FAST,
    messages,
    maxTokens = 1000,
    temperature = 0.7,
    jsonMode = false
  } = params;

  try {
    const startTime = Date.now();

    const response = await groq.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: 'json_object' } })
    });

    const message = response.choices[0]?.message;

    // GPT-OSS models sometimes return content in 'reasoning' field instead of 'content'
    // Check both fields and use whichever has content
    let content = message?.content || '';

    // If content is empty, check for reasoning field (GPT-OSS specific)
    if (!content && message && 'reasoning' in message) {
      content = (message as { reasoning?: string }).reasoning || '';
      console.log(`[Groq] Using reasoning field as content (${content.length} chars)`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Groq] ${model} responded in ${elapsed}ms (${content.length} chars)`);

    return content;
  } catch (error) {
    console.error('[Groq] API error:', error);
    throw error;
  }
}

/**
 * Generate patient response using Groq (ultra-fast)
 */
export async function generatePatientResponseGroq(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  return groqChatCompletion({
    model: GROQ_MODELS.FAST,
    messages: formattedMessages,
    maxTokens: 300,
    temperature: 0.7
  });
}

/**
 * Generate test/exam results using Groq (ultra-fast)
 */
export async function generateMedicalResultGroq(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return groqChatCompletion({
    model: GROQ_MODELS.FAST,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 400,
    temperature: 0.5
  });
}

/**
 * Parse and validate input using Groq (ultra-fast)
 */
export async function parseInputGroq(
  systemPrompt: string,
  userInput: string
): Promise<string> {
  return groqChatCompletion({
    model: GROQ_MODELS.FAST,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ],
    maxTokens: 1000,
    temperature: 0.3,
    jsonMode: true
  });
}

/**
 * Generate AI score using Groq (fast with good reasoning)
 */
export async function generateScoreGroq(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Use the smarter model for scoring since it requires reasoning
  return groqChatCompletion({
    model: GROQ_MODELS.SMART,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 2000,
    temperature: 0.3,
    jsonMode: true
  });
}

export { groq };
