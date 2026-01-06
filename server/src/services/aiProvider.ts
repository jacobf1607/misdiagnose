/**
 * Unified AI Provider Service
 *
 * Routes AI requests to the appropriate provider based on task type:
 * - FAST tasks (real-time, player waiting) → Groq GPT-OSS-20B (1000 T/sec)
 * - QUALITY tasks (background, complex) → OpenAI GPT-4o
 * - FALLBACK → Claude (Anthropic) if others fail
 *
 * Provider priority can be configured via AI_PROVIDER env var:
 * - 'hybrid' (default): Groq for fast tasks, OpenAI for quality tasks
 * - 'groq': Groq for everything
 * - 'openai': OpenAI for everything
 * - 'claude': Claude for everything (original behavior)
 */

import {
  isGroqAvailable,
  generatePatientResponseGroq,
  generateMedicalResultGroq,
  parseInputGroq,
  generateScoreGroq,
  groqChatCompletion,
  GROQ_MODELS
} from './groqService';

import {
  isOpenAIAvailable,
  generateCaseOpenAI,
  generatePathwayOpenAI,
  generateExplanationOpenAI,
  openaiChatCompletion,
  OPENAI_MODELS
} from './openaiChatService';

import Anthropic from '@anthropic-ai/sdk';

// Task types for routing
export type AITaskType =
  | 'patient_response'    // Real-time: patient roleplay
  | 'test_result'         // Real-time: generate test results
  | 'exam_finding'        // Real-time: generate exam findings
  | 'parse_input'         // Real-time: parse/validate user input
  | 'scoring'             // Real-time: AI scoring
  | 'case_generation'     // Background: generate medical case
  | 'ideal_pathway'       // Background: generate ideal pathway
  | 'explanation'         // Background: generate explanations
  | 'general';            // General purpose

// Provider types
export type AIProvider = 'groq' | 'openai' | 'claude' | 'hybrid';

// Get the configured AI provider
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() as AIProvider;
  if (['groq', 'openai', 'claude', 'hybrid'].includes(provider)) {
    return provider;
  }
  return 'hybrid'; // Default to hybrid
}

// Task to provider mapping for hybrid mode
const HYBRID_TASK_ROUTING: Record<AITaskType, 'groq' | 'openai' | 'claude'> = {
  // Real-time tasks → Groq (ultra-fast)
  patient_response: 'groq',
  test_result: 'groq',
  exam_finding: 'groq',
  parse_input: 'groq',
  scoring: 'groq',

  // Quality tasks → OpenAI (best quality)
  case_generation: 'openai',
  ideal_pathway: 'openai',
  explanation: 'openai',

  // General → Groq (fast default)
  general: 'groq'
};

/**
 * Get the provider to use for a specific task
 */
export function getProviderForTask(taskType: AITaskType): 'groq' | 'openai' | 'claude' {
  const mainProvider = getAIProvider();

  if (mainProvider === 'hybrid') {
    // Check availability and fall back if needed
    const preferredProvider = HYBRID_TASK_ROUTING[taskType];

    if (preferredProvider === 'groq' && isGroqAvailable()) {
      return 'groq';
    }
    if (preferredProvider === 'openai' && isOpenAIAvailable()) {
      return 'openai';
    }

    // Fallback chain: groq → openai → claude
    if (isGroqAvailable()) return 'groq';
    if (isOpenAIAvailable()) return 'openai';
    return 'claude';
  }

  if (mainProvider === 'groq' && isGroqAvailable()) {
    return 'groq';
  }
  if (mainProvider === 'openai' && isOpenAIAvailable()) {
    return 'openai';
  }

  return 'claude';
}

/**
 * Initialize Claude client (for fallback)
 */
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropicClient;
}

/**
 * Claude fallback for chat completion
 */
async function claudeChatCompletion(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { messages, maxTokens = 1000 } = params;

  const client = getAnthropicClient();

  // Extract system message
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const otherMessages = messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: maxTokens,
    system: systemMessage,
    messages: otherMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

/**
 * Universal AI completion function with automatic provider selection and fallback
 */
export async function aiCompletion(params: {
  taskType: AITaskType;
  systemPrompt: string;
  userPrompt: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const {
    taskType,
    systemPrompt,
    userPrompt,
    messages = [],
    maxTokens = 1000,
    temperature = 0.7,
    jsonMode = false
  } = params;

  const provider = getProviderForTask(taskType);
  console.log(`[AI] Task: ${taskType} → Provider: ${provider}`);

  // Build full messages array
  const fullMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages,
    { role: 'user', content: userPrompt }
  ];

  // Try primary provider
  try {
    switch (provider) {
      case 'groq':
        return await groqChatCompletion({
          model: taskType === 'scoring' ? GROQ_MODELS.SMART : GROQ_MODELS.FAST,
          messages: fullMessages,
          maxTokens,
          temperature,
          jsonMode
        });

      case 'openai':
        return await openaiChatCompletion({
          model: OPENAI_MODELS.BEST,
          messages: fullMessages,
          maxTokens,
          temperature,
          jsonMode
        });

      case 'claude':
        return await claudeChatCompletion({
          messages: fullMessages,
          maxTokens,
          temperature
        });
    }
  } catch (error) {
    console.error(`[AI] ${provider} failed:`, error);

    // Fallback chain
    const fallbackOrder: Array<'groq' | 'openai' | 'claude'> = ['groq', 'openai', 'claude'];
    const remainingProviders = fallbackOrder.filter(p => p !== provider);

    for (const fallbackProvider of remainingProviders) {
      try {
        console.log(`[AI] Falling back to ${fallbackProvider}...`);

        switch (fallbackProvider) {
          case 'groq':
            if (!isGroqAvailable()) continue;
            return await groqChatCompletion({
              model: GROQ_MODELS.FAST,
              messages: fullMessages,
              maxTokens,
              temperature,
              jsonMode
            });

          case 'openai':
            if (!isOpenAIAvailable()) continue;
            return await openaiChatCompletion({
              model: OPENAI_MODELS.BEST,
              messages: fullMessages,
              maxTokens,
              temperature,
              jsonMode
            });

          case 'claude':
            return await claudeChatCompletion({
              messages: fullMessages,
              maxTokens,
              temperature
            });
        }
      } catch (fallbackError) {
        console.error(`[AI] Fallback ${fallbackProvider} also failed:`, fallbackError);
        continue;
      }
    }

    throw new Error('All AI providers failed');
  }
}

/**
 * Get status of all AI providers
 */
export function getAIProviderStatus(): {
  configured: AIProvider;
  groq: { available: boolean; model: string };
  openai: { available: boolean; model: string };
  claude: { available: boolean; model: string };
} {
  return {
    configured: getAIProvider(),
    groq: {
      available: isGroqAvailable(),
      model: GROQ_MODELS.FAST
    },
    openai: {
      available: isOpenAIAvailable(),
      model: OPENAI_MODELS.BEST
    },
    claude: {
      available: !!process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-haiku-20241022'
    }
  };
}

// Re-export specific functions for convenience
export {
  generatePatientResponseGroq,
  generateMedicalResultGroq,
  parseInputGroq,
  generateScoreGroq,
  generateCaseOpenAI,
  generatePathwayOpenAI,
  generateExplanationOpenAI,
  isGroqAvailable,
  isOpenAIAvailable,
  GROQ_MODELS,
  OPENAI_MODELS
};
