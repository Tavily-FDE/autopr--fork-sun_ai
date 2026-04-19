// src/QueryAnalyzer.js
// Advanced query understanding and intent detection

import natural from 'natural';

const tokenizer = new natural.WordTokenizer();

class QueryAnalyzer {
  constructor() {
    this.intentPatterns = {
      'what_is': /^(what|what\'s|whats)\s+(is|are)/i,
      'how_to': /^(how|how\s+to|how\s+do|how\s+does)/i,
      'why': /^why\s+(is|are|do|does)/i,
      'when': /^when\s+(is|was|did|will)/i,
      'where': /^where\s+(is|are|do)/i,
      'who': /^who\s+(is|are)/i,
      'compare': /^(compare|versus|vs|difference|distinguish)/i,
      'list': /^(list|what\s+are|show me|give me)\s+(all|the|some)/i,
      'steps': /^(steps|how.*do|process|procedure)/i,
      'pros_cons': /^(pros\s+and\s+cons|advantages|disadvantages|benefits|drawbacks)/i,
      'definition': /^(define|definition|meaning|what.*mean)/i,
      'recent': /^(recent|latest|new|recent\s+developments)/i,
      'statistics': /^(statistics|stats|numbers|data|how many)/i,
      'explanation': /^(explain|tell me about|what about)/i,
      'prediction': /^(will|predict|forecast|expect|future)/i,
      'troubleshoot': /^(why|error|problem|not working|issue|bug|fix)/i
    };

    this.timeContextPatterns = {
      'real_time': /^(now|today|current|latest|recent|breaking|this week|this month|2024|2025)/i,
      'historical': /^(history|past|before|years ago|decades ago)/i,
      'future': /^(will|future|predict|forecast|expected|upcoming)/i
    };

    this.urgencyIndicators = {
      'high': /^(urgent|asap|immediately|critical|emergency|help|now)/i,
      'medium': /^(soon|fairly|quite|important|decide|choose)/i,
      'low': /^(curious|interested|learning|research|background)/i
    };
  }

  /**
   * TIER 1: Analyze query comprehensively
   */
  async analyze({ query, context = null, conversationHistory = [] }) {
    const startTime = Date.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 1: TEXT NORMALIZATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const normalizedQuery = this.normalize(query);
    const tokens = tokenizer.tokenize(normalizedQuery.toLowerCase());

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 2: INTENT DETECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const primaryIntent = this.detectPrimaryIntent(normalizedQuery);
    const secondaryIntent = this.detectSecondaryIntent(normalizedQuery, primaryIntent);
    const tertiaryIntent = this.detectTertiaryIntent(normalizedQuery);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 3: ENTITY EXTRACTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const entities = this.extractEntities(normalizedQuery, tokens);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 4: DOMAIN DETECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const requiredDomains = this.detectDomains(normalizedQuery, entities);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 5: TIME CONTEXT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const timeContext = this.detectTimeContext(normalizedQuery);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 6: URGENCY DETECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const urgency = this.detectUrgency(normalizedQuery);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 7: COMPLEXITY ASSESSMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const complexity = this.assessComplexity({
      query: normalizedQuery,
      entities: entities.length,
      domains: requiredDomains.length,
      intent: primaryIntent,
      tokens: tokens.length
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 8: SEARCH QUERY GENERATION (Multi-angle)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const searchQueries = this.generateSearchQueries({
      originalQuery: normalizedQuery,
      intent: primaryIntent,
      entities,
      domains: requiredDomains,
      complexity
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STAGE 9: CONTEXT AWARENESS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const contextAwareness = this.applyContextAwareness({
      query: normalizedQuery,
      conversationHistory,
      lastContext: context
    });

    return {
      originalQuery: query,
      normalizedQuery,
      primaryIntent,
      secondaryIntent,
      tertiaryIntent,
      entities,
      requiredDomains,
      searchQueries,
      complexity,
      urgency,
      timeContext,
      contextAwareness,
      tokenCount: tokens.length,
      analysisTime: `${Date.now() - startTime}ms`
    };
  }

  /**
   * Normalize query (fix typos, expand abbreviations)
   */
  normalize(query) {
    let normalized = query.trim();

    // Common abbreviations
    const abbreviations = {
      "what's": 'what is',
      "who's": 'who is',
      "it's": 'it is',
      "that's": 'that is',
      "there's": 'there is',
      "where's": 'where is',
      "how's": 'how is',
      "i'm": 'i am',
      "you're": 'you are',
      "they're": 'they are',
      "we're": 'we are',
      "wouldn't": 'would not',
      "couldn't": 'could not',
      "shouldn't": 'should not',
      "didn't": 'did not',
      "haven't": 'have not',
      "hasn't": 'has not',
      "wasn't": 'was not',
      "aren't": 'are not',
      "isn't": 'is not',
      "don't": 'do not',
      "doesn't": 'does not'
    };

    for (const [abbr, full] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      normalized = normalized.replace(regex, full);
    }

    return normalized;
  }

  /**
   * Detect primary intent (what user is asking)
   */
  detectPrimaryIntent(query) {
    for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
      if (pattern.test(query)) {
        return intent;
      }
    }
    return 'general_information';
  }

  /**
   * Detect secondary intent (what user wants to accomplish)
   */
  detectSecondaryIntent(query, primaryIntent) {
    const secondaryIntents = {
      'learning': /^(learn|understand|explain|how|teach me)/i,
      'decision_making': /^(should|choose|which|better|pros|cons|compare)/i,
      'problem_solving': /^(fix|solve|error|help|troubleshoot|problem)/i,
      'research': /^(research|investigate|explore|discover|find)/i,
      'validation': /^(verify|check|confirm|is it true|fact check)/i,
      'comparison': /^(versus|vs|compare|difference|instead of)/i,
      'execution': /^(how to|steps|procedure|process|guide)/i
    };

    for (const [intent, pattern] of Object.entries(secondaryIntents)) {
      if (pattern.test(query)) {
        return intent;
      }
    }

    return primaryIntent;
  }

  /**
   * Detect tertiary intent (deep motivation)
   */
  detectTertiaryIntent(query) {
    const intents = {
      'emotional': /^(feel|think|believe|opinion|what.*think)/i,
      'ethical': /^(should|moral|right|wrong|ethical)/i,
      'practical': /^(how.*use|apply|implement|work)/i,
      'theoretical': /^(why|cause|reason|mechanism|how.*work)/i,
      'predictive': /^(will|future|expect|predict|forecast)/i,
      'strategic': /^(strategy|plan|approach|best way|optimal)/i
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(query)) {
        return intent;
      }
    }

    return 'information_seeking';
  }

  /**
   * Extract named entities and keywords
   */
  extractEntities(query, tokens) {
    const entities = [];

    // Person names (capitalized words)
    const capitalizedWords = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    entities.push(...capitalizedWords.map(w => ({ type: 'person_or_place', value: w })));

    // Quotations
    const quotedPhrases = query.match(/"([^"]+)"/g) || [];
    entities.push(...quotedPhrases.map(q => ({ type: 'quoted_phrase', value: q.replace(/"/g, '') })));

    // Years and numbers
    const numbers = query.match(/\b(20\d{2}|19\d{2}|\d+%|\$\d+|#\d+)\b/g) || [];
    entities.push(...numbers.map(n => ({ type: 'number', value: n })));

    // Technical terms (words in backticks or code)
    const technicalTerms = query.match(/`([^`]+)`/g) || [];
    entities.push(...technicalTerms.map(t => ({ type: 'technical', value: t.replace(/`/g, '') })));

    return entities;
  }

  /**
   * Detect required domains
   */
  detectDomains(query, entities) {
    const domains = new Set();

    // Domain keywords
    const domainKeywords = {
      'technology': /^(AI|ML|software|code|programming|computer|tech|digital|app|web)/i,
      'science': /^(physics|chemistry|biology|quantum|research|study|experiment)/i,
      'business': /^(business|finance|market|stock|company|startup|venture|enterprise)/i,
      'health': /^(health|medical|doctor|disease|treatment|medicine|wellness)/i,
      'history': /^(history|historical|war|revolution|ancient|medieval)/i,
      'sports': /^(sport|game|team|player|league|championship|match)/i,
      'entertainment': /^(movie|music|actor|song|entertainment|show|entertainment)/i,
      'politics': /^(politics|government|law|policy|election|congress)/i,
      'geography': /^(country|city|map|location|continent|border)/i,
      'education': /^(school|university|education|learn|study|course)/i
    };

    for (const [domain, pattern] of Object.entries(domainKeywords)) {
      if (pattern.test(query)) {
        domains.add(domain);
      }
    }

    // Use entities to infer domains
    entities.forEach(entity => {
      // Map entity values to domains
      const entityStr = entity.value.toLowerCase();
      
      if (entityStr.includes('covid') || entityStr.includes('vaccine')) {
        domains.add('health');
      }
      if (entityStr.includes('python') || entityStr.includes('javascript')) {
        domains.add('technology');
      }
      if (entityStr.includes('congress') || entityStr.includes('parliament')) {
        domains.add('politics');
      }
    });

    return Array.from(domains);
  }

  /**
   * Detect time context requirement
   */
  detectTimeContext(query) {
    for (const [context, pattern] of Object.entries(this.timeContextPatterns)) {
      if (pattern.test(query)) {
        return context;
      }
    }
    return 'general';
  }

  /**
   * Detect urgency level
   */
  detectUrgency(query) {
    for (const [level, pattern] of Object.entries(this.urgencyIndicators)) {
      if (pattern.test(query)) {
        return level;
      }
    }
    return 'normal';
  }

  /**
   * Assess query complexity
   */
  assessComplexity({ query, entities, domains, intent, tokens }) {
    let complexity = 1;

    // Token complexity
    if (tokens > 10) complexity += 1;
    if (tokens > 20) complexity += 1;
    if (tokens > 30) complexity += 1;

    // Entity complexity
    if (entities > 2) complexity += 1;
    if (entities > 5) complexity += 1;

    // Domain complexity
    if (domains > 1) complexity += 1;
    if (domains > 3) complexity += 1;

    // Intent complexity
    const complexIntents = ['compare', 'steps', 'pros_cons', 'prediction', 'troubleshoot'];
    if (complexIntents.includes(intent)) complexity += 2;

    // Multi-part questions
    if (query.includes('and') || query.includes('or') || query.includes('also')) {
      complexity += 1;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Generate multiple search queries from different angles
   */
  generateSearchQueries({ originalQuery, intent, entities, domains, complexity }) {
    const queries = new Set();

    // Original query
    queries.add(originalQuery);

    // Intent-based variations
    switch (intent) {
      case 'what_is':
        queries.add(`definition of ${originalQuery.replace(/^what\s+(is|are)\s+/, '')}`);
        queries.add(`${originalQuery.replace(/^what\s+(is|are)\s+/, '')} meaning`);
        break;
      case 'how_to':
        queries.add(`${originalQuery.replace(/^how\s+(to|do|does)\s+/, '')} tutorial`);
        queries.add(`${originalQuery.replace(/^how\s+(to|do|does)\s+/, '')} steps`);
        queries.add(`${originalQuery.replace(/^how\s+(to|do|does)\s+/, '')} guide`);
        break;
      case 'why':
        queries.add(originalQuery.replace(/^why\s+/, 'reasons '));
        queries.add(originalQuery.replace(/^why\s+/, 'causes '));
        break;
      case 'compare':
        queries.add(originalQuery);
        queries.add(`${originalQuery} pros and cons`);
        queries.add(`${originalQuery} differences`);
        break;
      case 'statistics':
        queries.add(`${originalQuery} statistics`);
        queries.add(`${originalQuery} numbers`);
        queries.add(`${originalQuery} data`);
        break;
      case 'recent':
        queries.add(`${originalQuery} 2024`);
        queries.add(`${originalQuery} latest`);
        queries.add(`${originalQuery} recent developments`);
        break;
    }

    // Entity-based variations
    entities.forEach(entity => {
      if (entity.type === 'person_or_place') {
        queries.add(`${entity.value} ${originalQuery.replace(entity.value, '')}`);
      }
    });

    // Domain-specific variations
    domains.forEach(domain => {
      queries.add(`${domain} ${originalQuery}`);
    });

    // Complexity-based expansion
    if (complexity > 6) {
      queries.add(`comprehensive ${originalQuery}`);
      queries.add(`detailed ${originalQuery}`);
      queries.add(`in depth ${originalQuery}`);
    }

    return Array.from(queries).slice(0, 8); // Max 8 search queries
  }

  /**
   * Apply conversation context awareness
   */
  applyContextAwareness({ query, conversationHistory, lastContext }) {
    const contextAwareness = {
      isFollowUp: false,
      relatedToPrevious: false,
      shouldReferToContext: false,
      contextSummary: null
    };

    if (conversationHistory.length > 0) {
      contextAwareness.isFollowUp = !query.includes('about') && !query.includes('regarding');
      
      const lastQuery = conversationHistory[conversationHistory.length - 1]?.query || '';
      const similarity = this.calculateSimilarity(query, lastQuery);
      
      contextAwareness.relatedToPrevious = similarity > 0.3;
      contextAwareness.shouldReferToContext = similarity > 0.5;
    }

    return contextAwareness;
  }

  /**
   * Calculate query similarity (simple cosine similarity)
   */
  calculateSimilarity(query1, query2) {
    const tokens1 = new Set(tokenizer.tokenize(query1.toLowerCase()));
    const tokens2 = new Set(tokenizer.tokenize(query2.toLowerCase()));

    const intersection = [...tokens1].filter(t => tokens2.has(t)).length;
    const union = tokens1.size + tokens2.size - intersection;

    return union === 0 ? 0 : intersection / union;
  }
}

export default QueryAnalyzer;
