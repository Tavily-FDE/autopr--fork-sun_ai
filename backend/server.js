import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';
import winston from 'winston';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

import SearchEngine from './src/SearchEngine.js';
import QueryAnalyzer from './src/QueryAnalyzer.js';
import {
  SourceVerifier,
  ResponseBuilder,
  ConversationManager,
  RankingEngine
} from './src/modules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY environment variable is not set');
  process.exit(1);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sun-ai' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use((req, res, next) => {
  const requestId = uuidv4();
  req.id = requestId;
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
});

app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));

const groqClient = new Groq({ apiKey: GROQ_API_KEY });
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const conversationManager = new ConversationManager({ maxConversations: 1000 });
const queryAnalyzer = new QueryAnalyzer();
const searchEngine = new SearchEngine();
const sourceVerifier = new SourceVerifier({ cache, logger });
const rankingEngine = new RankingEngine();
const responseBuilder = new ResponseBuilder({ logger });

app.post('/api/search', async (req, res) => {
  return handleSearchRequest(req, res);
});

app.post('/api/research', async (req, res) => {
  req.body.mode = 'research';
  req.body.depth = 'deep';
  return handleSearchRequest(req, res);
});

app.post('/api/verify', async (req, res) => {
  try {
    const { claim } = req.body;

    if (!claim) {
      return res.status(400).json({
        success: false,
        error: 'Claim required'
      });
    }

    const verified = await sourceVerifier.verifyClaim(claim);

    res.json({
      success: true,
      claim,
      result: verified,
      confidence: verified.confidence
    });
  } catch (error) {
    logger.error({ action: 'verify_failed', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/conversation/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const history = conversationManager.getConversation(conversationId);

    res.json({
      success: true,
      conversationId,
      exchanges: history || [],
      count: history?.length || 0
    });
  } catch (error) {
    logger.error({ action: 'get_conversation_failed', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/conversation/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    conversationManager.clearConversation(conversationId);

    res.json({
      success: true,
      message: 'Conversation cleared',
      conversationId
    });
  } catch (error) {
    logger.error({ action: 'clear_conversation_failed', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

async function handleSearchRequest(req, res) {
  const requestId = req.id;
  const startTime = Date.now();

  try {
    const {
      query,
      conversationId = uuidv4(),
      mode = 'default',
      depth = 'standard'
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query cannot be empty',
        requestId
      });
    }

    if (query.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Query too long (max 5000 characters)',
        requestId
      });
    }

    logger.info({ requestId, action: 'search_initiated', query: query.substring(0, 100) });

    const conversationHistory = conversationManager.getConversation(conversationId) || [];
    const analysis = await queryAnalyzer.analyze({ query, conversationHistory });
    const searchQueries = analysis.searchQueries.slice(0, depth === 'deep' ? 4 : 3);
    const searchResults = await searchEngine.parallelSearch({
      queries: searchQueries,
      depth: depth === 'deep' ? 3 : 2,
      resultsPerQuery: depth === 'deep' ? 6 : 4,
      timeContext: mapTimeContext(analysis.timeContext)
    });
    const verifiedSources = await sourceVerifier.verify({
      sources: searchResults.results,
      requestId
    });
    const rankedSources = await rankingEngine.rank({
      results: verifiedSources,
      query,
      intent: analysis.primaryIntent,
      topK: 6
    });

    if (rankedSources.length === 0) {
      return res.status(502).json({
        success: false,
        error: 'No verifiable sources were retrieved for this query.',
        requestId
      });
    }

    let aiResponse;

    try {
      const groqResponse = await groqClient.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: buildCitationSystemPrompt(mode)
          },
          {
            role: 'user',
            content: buildGroundedUserPrompt({
              query,
              sources: rankedSources,
              mode,
              conversationHistory
            })
          }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: mode === 'research' ? 1600 : 1100
      });

      aiResponse = groqResponse.choices[0].message.content;
    } catch (groqError) {
      logger.error({ requestId, action: 'groq_error', error: groqError.message });
      aiResponse = buildFallbackSynthesis(query, rankedSources);
    }

    const builtResponse = await responseBuilder.build({
      aiContent: aiResponse,
      sources: rankedSources,
      query,
      mode,
      metadata: {
        searchQueries,
        resultCount: searchResults.resultCount
      }
    });

    conversationManager.addExchange(conversationId, {
      query,
      response: builtResponse.answer,
      timestamp: new Date(),
      intent: analysis.primaryIntent,
      sources: builtResponse.sourceIndex
    });

    const totalTime = Date.now() - startTime;
    const citedSources = builtResponse.sourceCards.filter((source) =>
      builtResponse.citations.includes(source.citationNumber)
    );

    res.json({
      success: true,
      requestId,
      conversationId,
      response: builtResponse.answer,
      sections: builtResponse.sections,
      sources: builtResponse.sourceCards,
      sourceIndex: builtResponse.sourceIndex,
      sourceCards: builtResponse.sourceCards,
      sourceCoverage: builtResponse.sourceCoverage,
      citations: {
        extractedNumbers: builtResponse.citations,
        citedSources,
        confidence: builtResponse.confidence
      },
      metadata: {
        totalTime: `${totalTime}ms`,
        sourceCount: builtResponse.sourceCards.length,
        citationCount: builtResponse.citations.length,
        confidenceLevel: builtResponse.confidence.level,
        confidenceScore: builtResponse.confidence.score,
        intent: analysis.primaryIntent,
        complexity: analysis.complexity,
        mode,
        queryCount: searchQueries.length,
        resultCount: searchResults.resultCount
      }
    });

    logger.info({
      requestId,
      action: 'search_completed',
      totalTime,
      success: true
    });
  } catch (error) {
    logger.error({
      requestId,
      action: 'search_failed',
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      requestId
    });
  }
}

function mapTimeContext(timeContext) {
  if (timeContext === 'real_time') {
    return 'recent';
  }

  return 'general';
}

function buildCitationSystemPrompt(mode) {
  return `You are a high-performance AI search synthesis engine operating on top of a multi-source retrieval system.

PRIMARY OBJECTIVE:
MAXIMIZE INFORMATION COVERAGE ACROSS ALL AVAILABLE SOURCE TYPES AND ENSURE ZERO LOSS OF EXTRACTABLE INFORMATION.

CORE RULES:
- Use ONLY the provided sources, but use the MAXIMUM number of them that are relevant.
- Do NOT rely on a small subset when more sources are available.
- Every extractable fact from any relevant source must appear in the answer when it materially helps.
- Especially preserve numbers, dates, prices, percentages, names, metrics, ranges, and timestamps.
- If ANY source contains the exact answer, extract it explicitly.
- If multiple sources provide values, prefer the latest value or show the range/conflict explicitly.
- Every factual statement must include inline citations like [1] or [1][2].
- Reuse citation numbers consistently and order multiple citations by relevance.
- Avoid single-category dominance when multiple source categories are available.
- Do not invent facts, citations, sources, categories, or missing values.
- Do not output confidence, evidence panel, or source cards.

MANDATORY EXECUTION LOGIC:
1. Classify the query intent.
2. Reflect the widest relevant source coverage across the provided sources.
3. Extract all explicit data points.
4. Merge and resolve conflicts.
5. Present the answer with maximum useful citations.

OUTPUT FORMAT:
ANSWER:
Direct, data-rich answer with key values and inline citations.

KEY DATA POINTS:
- Fact with exact values and inline citations
- Fact with exact values and inline citations

SOURCE COVERAGE:
- Categories used: comma-separated list of source categories actually used

SOURCES:
- [1] Source title
- [2] Source title

Mode guidance: ${getModeSpecificInstructions(mode)}`;
}

function buildGroundedUserPrompt({ query, sources, mode, conversationHistory }) {
  const recentContext = conversationHistory
    .slice(-2)
    .map((entry, index) => `Context ${index + 1}: ${entry.query}`)
    .join('\n');

  const formattedSources = sources
    .map((source, index) => formatSourceForPrompt(source, index + 1))
    .join('\n\n');

  return [
    `Query: ${query}`,
    `Mode: ${mode}`,
    recentContext ? `Recent conversation:\n${recentContext}` : '',
    'Use only these ranked sources:',
    formattedSources
  ].filter(Boolean).join('\n\n');
}

function formatSourceForPrompt(source, citationNumber) {
  const snippet = (source.snippet || source.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);

  return [
    `[${citationNumber}] ${source.title}`,
    `URL: ${source.url}`,
    `Domain: ${source.domain || 'unknown'}`,
    `Type: ${source.sourceType || 'general'}`,
    `Credibility: ${Math.round(source.credibility || 0)}`,
    `Relevance: ${Math.round(source.score || 0)}`,
    `Snippet: ${snippet || 'No snippet available.'}`
  ].join('\n');
}

function buildFallbackSynthesis(query, sources) {
  const topSources = sources.slice(0, 3).map((source, index) => ({
    citationNumber: index + 1,
    title: source.title
  }));
  const firstCitation = topSources[0] ? `[${topSources[0].citationNumber}]` : '';
  const pairedCitation = topSources[1] ? `${firstCitation}[${topSources[1].citationNumber}]` : firstCitation;

  return [
    'ANSWER:',
    `I found relevant sources for "${query}", but the synthesis model was unavailable, so this answer is a conservative fallback ${pairedCitation}.`,
    '',
    'EXPLANATION:',
    `The system retrieved ranked sources and preserved them for inspection ${firstCitation}. Review the source index and evidence panel below before treating the answer as complete ${pairedCitation || firstCitation}.`,
    '',
    'KEY DATA POINTS:',
    `- Retrieved sources are real URLs ranked for relevance ${firstCitation}.`,
    `- This fallback is low confidence because it is not a full synthesis ${(pairedCitation || firstCitation)}.`,
    '',
    'SOURCES:',
    ...topSources.map((source) => `- [${source.citationNumber}] ${source.title}`)
  ].join('\n');
}

function getModeSpecificInstructions(mode) {
  const instructions = {
    research: 'Give a broader synthesis and compare sources when they overlap.',
    verify: 'Focus on what is established, uncertain, or conflicting across sources.',
    explain: 'Use simpler language while keeping citations attached to every factual claim.',
    quick: 'Be concise, but still cite every factual claim.',
    academic: 'Use formal language and favor research-oriented evidence.',
    default: 'Provide a balanced answer grounded in the cited sources.'
  };

  return instructions[mode] || instructions.default;
}

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
    return;
  }

  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    availableEndpoints: [
      'POST /api/search',
      'POST /api/research',
      'POST /api/verify',
      'GET /api/conversation/:conversationId',
      'DELETE /api/conversation/:conversationId',
      'GET /api/health'
    ]
  });
});

app.use((err, req, res, next) => {
  logger.error({
    action: 'unhandled_error',
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  logger.info({
    message: 'SUN ai Server Started',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });

  console.log(`SUN ai server running on port ${PORT}`);
});
