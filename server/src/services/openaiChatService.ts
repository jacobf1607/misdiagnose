/**
 * OpenAI Chat Service - High-quality inference using OpenAI
 *
 * Used for complex tasks requiring highest quality:
 * - Case generation
 * - Ideal pathway generation
 * - Pre-computed explanations
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Available OpenAI models
export const OPENAI_MODELS = {
  // Highest quality - GPT-5.2 for complex medical reasoning
  BEST: 'gpt-5.2',

  // Fast and capable - good balance
  FAST: 'gpt-4o-mini',

  // Chat optimized version
  CHAT: 'gpt-5.2-chat-latest',
} as const;

export type OpenAIModel = typeof OPENAI_MODELS[keyof typeof OPENAI_MODELS];

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate a chat completion using OpenAI
 */
export async function openaiChatCompletion(params: {
  model?: OpenAIModel;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const {
    model = OPENAI_MODELS.BEST,
    messages,
    maxTokens = 2000,
    temperature = 0.7,
    jsonMode = false
  } = params;

  try {
    const startTime = Date.now();

    // GPT-5.2 requires max_completion_tokens instead of max_tokens
    const isGpt5 = model.startsWith('gpt-5');

    const response = await openaiClient.chat.completions.create({
      model,
      messages,
      ...(isGpt5 ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      temperature,
      ...(jsonMode && { response_format: { type: 'json_object' } })
    });

    const content = response.choices[0]?.message?.content || '';
    const elapsed = Date.now() - startTime;

    console.log(`[OpenAI] ${model} responded in ${elapsed}ms (${content.length} chars)`);

    return content;
  } catch (error) {
    console.error('[OpenAI] API error:', error);
    throw error;
  }
}

/**
 * Generate a medical case using OpenAI (high quality)
 */
export async function generateCaseOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return openaiChatCompletion({
    model: OPENAI_MODELS.BEST,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 3000,
    temperature: 0.8,
    jsonMode: true
  });
}

/**
 * Generate ideal pathway using OpenAI (high quality)
 */
export async function generatePathwayOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return openaiChatCompletion({
    model: OPENAI_MODELS.BEST,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 3500,
    temperature: 0.5,
    jsonMode: true
  });
}

/**
 * Generate diagnosis explanation using OpenAI (high quality)
 */
export async function generateExplanationOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return openaiChatCompletion({
    model: OPENAI_MODELS.BEST,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 1500,
    temperature: 0.5,
    jsonMode: true
  });
}

export { openaiClient };
