import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import gameRoutes from './routes/game';
import userRoutes from './routes/user';
import feedbackRoutes from './routes/feedback';
import challengeRoutes from './routes/challenge';
import notificationRoutes from './routes/notification';
import analyticsRoutes from './routes/analytics';
import { initializePool, getPoolStatus } from './services/casePoolManager';
import { startBackgroundGenerator, getGeneratorStatus } from './services/backgroundGenerator';
import { getAIProviderStatus } from './services/aiProvider';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? [
        process.env.FRONTEND_URL || '',
        /\.railway\.app$/,  // Allow Railway domains
        /\.up\.railway\.app$/,
        'https://misdiagnose.in',
        'https://www.misdiagnose.in'
      ].filter(Boolean)
    : '*',  // Allow all in development
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/telemetry', analyticsRoutes);

// Health check - now includes pool status and AI provider info
app.get('/api/health', (req, res) => {
  const poolStatus = getPoolStatus();
  const generatorStatus = getGeneratorStatus();
  const aiStatus = getAIProviderStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    casePool: {
      totalCases: poolStatus.totalCases,
      availableCases: poolStatus.availableCases,
      belowThreshold: poolStatus.belowThreshold
    },
    backgroundGenerator: generatorStatus,
    aiProviders: aiStatus
  });
});

// AI Provider status endpoint
app.get('/api/ai-status', (req, res) => {
  const aiStatus = getAIProviderStatus();
  res.json({
    ...aiStatus,
    taskRouting: {
      realTime: ['patient_response', 'test_result', 'exam_finding', 'parse_input', 'scoring'],
      background: ['case_generation', 'ideal_pathway', 'explanation']
    },
    models: {
      groq_fast: 'llama-3.1-8b-instant (560 T/sec) - direct responses',
      groq_smart: 'openai/gpt-oss-120b (500 T/sec) - reasoning/scoring',
      openai_best: 'gpt-5.2 (highest quality) - case generation'
    },
    description: {
      hybrid: 'Groq (Llama 3.1 8B) for real-time tasks, OpenAI (GPT-5.2) for quality tasks',
      groq: 'Groq for all tasks (ultra-fast)',
      openai: 'OpenAI for all tasks (high quality)',
      claude: 'Claude/Anthropic for all tasks (original)'
    }
  });
});

// Initialize case pool and start server
async function startServer() {
  try {
    // Initialize case pool
    console.log('[Server] Initializing case pool...');
    await initializePool();
    const poolStatus = getPoolStatus();
    console.log(`[Server] Case pool ready: ${poolStatus.availableCases} available, ${poolStatus.totalCases} total`);

    // Start background generator if enabled
    if (process.env.ENABLE_BACKGROUND_GENERATION?.toLowerCase() === 'true') {
      console.log('[Server] Starting background case generator...');
      startBackgroundGenerator();
    } else {
      console.log('[Server] Background generation disabled (set ENABLE_BACKGROUND_GENERATION=true to enable)');
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`[Server] Misdiagnose server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

export default app;
