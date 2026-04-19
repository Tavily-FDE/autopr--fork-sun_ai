// src/SourceVerifier.js
export class SourceVerifier {
  constructor({ cache, logger }) {
    this.cache = cache;
    this.logger = logger;
  }

  async verify({ sources, requestId }) {
    return sources.map((source) => ({
      ...source,
      credibility: this.calculateCredibility(source),
      domain: this.extractDomain(source.url),
      sourceType: this.classifySourceType(source.url),
      freshness: this.calculateFreshness(source.timestamp),
      verified: true
    }));
  }

  calculateCredibility(source) {
    const baseScore = source.credibility || 50;
    const contentScore = (source.content || '').length > 500 ? 10 : 0;
    const titleScore = (source.title || '').length > 20 ? 5 : 0;

    return Math.min(100, baseScore + contentScore + titleScore);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
      return 'unknown';
    }
  }

  classifySourceType(url) {
    const types = {
      academic: /edu|research|arxiv|nature|science/i,
      news: /bbc|guardian|nyt|washington|reuters|ap|economist|forbes|techcrunch/i,
      government: /gov|parliament|congress/i,
      reference: /wikipedia|britannica|encyclopedia/i,
      technical: /github|stackoverflow|medium|dev\.to|developer\.mozilla/i,
      community: /reddit|quora|stackexchange/i
    };

    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(url)) {
        return type;
      }
    }

    return 'general';
  }

  calculateFreshness(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);

    if (daysOld < 1) return 'very_recent';
    if (daysOld < 7) return 'recent';
    if (daysOld < 30) return 'current';
    if (daysOld < 365) return 'recent_year';
    return 'archive';
  }

  async verifyClaim(claim) {
    return {
      claim,
      confidence: 'medium',
      status: 'contested'
    };
  }
}

// src/ResponseBuilder.js
export class ResponseBuilder {
  constructor({ logger }) {
    this.logger = logger;
  }

  async build({ aiContent, sources, query, mode, metadata }) {
    const normalizedSources = this.normalizeSources(sources);
    const sections = this.extractSections(aiContent);
    const citations = this.extractCitations([
      sections.answer,
      ...sections.keyPoints,
      ...sections.sourceMentions
    ].join('\n'));
    const confidence = this.calculateConfidenceLevel(citations, normalizedSources);
    const sourceIndex = normalizedSources.map((source) => this.buildSourceIndexEntry(source));
    const sourceCards = normalizedSources.map((source) => this.buildSourceCard(source));
    const sourceCoverage = this.buildSourceCoverage({
      normalizedSources,
      citations,
      declaredCoverage: sections.sourceCoverage
    });
    const renderedResponse = this.composePlainTextResponse({
      sections,
      sourceIndex,
      sourceCoverage,
      confidence
    });

    return {
      answer: renderedResponse,
      sections,
      sourceIndex,
      sourceCards,
      sourceCoverage,
      citations,
      confidence,
      structure: this.analyzeStructure(renderedResponse),
      formattedForUI: this.formatForUI(renderedResponse),
      metadata: {
        mode,
        query,
        sourceCount: normalizedSources.length,
        ...metadata
      }
    };
  }

  normalizeSources(sources) {
    return sources.map((source, index) => {
      const citationNumber = index + 1;
      const domain = source.domain || this.extractDomain(source.url);
      const category = this.toCategory(source.sourceType || source.type || domain);
      const relevance = Math.round(source.score || source.relevance || 0);
      const credibility = Math.round(source.credibility || 0);
      const snippet = this.buildSnippet(source);

      return {
        ...source,
        citationNumber,
        domain,
        category,
        type: category,
        relevance,
        credibility,
        keyInsight: this.buildKeyInsight(source, snippet),
        snippet
      };
    });
  }

  extractSections(content) {
    const answer = this.extractSection(content, 'ANSWER');
    const keyPointsBlock = this.extractSection(content, 'KEY DATA POINTS')
      || this.extractSection(content, 'KEY POINTS');
    const sourceCoverageBlock = this.extractSection(content, 'SOURCE COVERAGE');
    const sourcesBlock = this.extractSection(content, 'SOURCES');

    return {
      answer: answer || content.trim() || 'No answer generated.',
      keyPoints: this.parseKeyPoints(keyPointsBlock),
      sourceCoverage: this.parseCoverage(sourceCoverageBlock),
      sourceMentions: this.parseKeyPoints(sourcesBlock)
    };
  }

  extractSection(content, heading) {
    const escapedHeading = heading.replace(/\s+/g, '\\s+');
    const pattern = new RegExp(`${escapedHeading}:?\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:?\\s|$)`, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : '';
  }

  parseKeyPoints(content = '') {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  parseCoverage(content = '') {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*]\s*/, '').replace(/^Categories used:\s*/i, '').trim())
      .flatMap((line) => line.split(',').map((part) => part.trim()))
      .map((part) => this.normalizeCoverageLabel(part))
      .filter(Boolean);
  }

  extractCitations(text) {
    const citationRegex = /\[(\d+)\]/g;
    const citations = new Set();
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      citations.add(Number.parseInt(match[1], 10));
    }

    return Array.from(citations).sort((a, b) => a - b);
  }

  calculateConfidenceLevel(citationIndices, sources) {
    const citedSources = sources.filter((source) => citationIndices.includes(source.citationNumber));
    const averageCredibility = citedSources.length
      ? citedSources.reduce((sum, source) => sum + source.credibility, 0) / citedSources.length
      : 0;

    if (citedSources.length >= 3 && averageCredibility >= 80) {
      return { level: 'High', score: 92, reason: 'Multiple strong sources support the answer.' };
    }

    if (citedSources.length >= 2) {
      return { level: 'Medium', score: 74, reason: 'At least two sources support the main claims.' };
    }

    if (citedSources.length === 1) {
      return { level: 'Low', score: 48, reason: 'Only one source is cited, so support is limited.' };
    }

    return { level: 'Low', score: 20, reason: 'The response does not contain usable source attribution.' };
  }

  buildSourceIndexEntry(source) {
    return {
      citationNumber: source.citationNumber,
      title: source.title,
      domain: source.domain,
      type: source.type,
      relevance: source.relevance,
      summary: source.keyInsight,
      url: source.url
    };
  }

  buildSourceCard(source) {
    return {
      citationNumber: source.citationNumber,
      title: source.title,
      domain: source.domain,
      category: source.type,
      relevanceScore: source.relevance,
      credibilityScore: source.credibility,
      keyInsight: source.keyInsight,
      snippet: source.snippet,
      url: source.url
    };
  }

  buildSourceCoverage({ normalizedSources, citations, declaredCoverage }) {
    const citedSources = normalizedSources.filter((source) => citations.includes(source.citationNumber));
    const categories = citedSources.length
      ? citedSources.map((source) => source.type)
      : normalizedSources.map((source) => source.type);
    const mergedCategories = [...new Set([...(declaredCoverage || []), ...categories].map((category) => this.normalizeCoverageLabel(category)).filter(Boolean))];

    return {
      categories: mergedCategories,
      label: mergedCategories.join(', ') || 'Docs'
    };
  }

  composePlainTextResponse({ sections, sourceIndex, sourceCoverage, confidence }) {
    const keyPoints = sections.keyPoints.length
      ? sections.keyPoints.map((point) => `- ${point}`).join('\n')
      : '- No key points generated.';
    const sourceMentions = sections.sourceMentions?.length
      ? sections.sourceMentions.map((point) => `- ${point}`).join('\n')
      : sourceIndex.map((source) => `- [${source.citationNumber}] ${source.title}`).join('\n');
    const sources = sourceIndex
      .map((source) => [
        `[${source.citationNumber}] ${source.title}`,
        `- Domain: ${source.domain}`,
        `- Type: ${source.type}`,
        `- Relevance: ${source.relevance}%`,
        `- Summary: ${source.summary}`
      ].join('\n'))
      .join('\n\n');
    const evidencePanel = sourceIndex
      .map((source) => `- [${source.citationNumber}] ${source.title} | ${source.domain} | ${source.type} | ${source.relevance}% relevance`)
      .join('\n');

    return [
      'Answer',
      sections.answer,
      '',
      'Key Data Points',
      keyPoints,
      '',
      'Source Coverage',
      `- Categories used: ${sourceCoverage.label}`,
      '',
      'Source References',
      sourceMentions,
      '',
      'Sources',
      sources,
      '',
      'Evidence Panel',
      evidencePanel,
      '',
      'Confidence Level',
      `${confidence.level} (${confidence.score}) - ${confidence.reason}`
    ].join('\n');
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (error) {
      return 'unknown';
    }
  }

  toCategory(value = '') {
    const normalized = value.toLowerCase();

    if (normalized.includes('academic') || normalized.includes('research')) {
      return 'Research';
    }

    if (normalized.includes('government')) {
      return 'Government';
    }

    if (normalized.includes('news')) {
      return 'News';
    }

    if (normalized.includes('reference')) {
      return 'Structured Knowledge';
    }

    if (normalized.includes('community')) {
      return 'Community';
    }

    if (normalized.includes('commercial') || normalized.includes('company')) {
      return 'Company Sources';
    }

    return 'Docs';
  }

  normalizeCoverageLabel(value = '') {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return '';
    }

    const mapping = {
      docs: 'Docs',
      documentation: 'Docs',
      news: 'News',
      research: 'Research',
      community: 'Community',
      government: 'Government',
      'structured knowledge': 'Structured Knowledge',
      structured: 'Structured Knowledge',
      general: 'Docs',
      'company sources': 'Company Sources'
    };

    return mapping[normalized] || value.trim();
  }

  buildSnippet(source) {
    const raw = source.snippet || source.content || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 220) || 'No snippet available from this source.';
  }

  buildKeyInsight(source, snippet) {
    return [source.description, snippet].filter(Boolean).join(' ').slice(0, 180);
  }

  analyzeStructure(content) {
    return {
      hasSummary: content.includes('summary') || content.includes('Summary'),
      hasKeyPoints: content.includes('- '),
      hasCitations: /\[\d+\]/.test(content),
      paragraphs: (content.match(/\n\n/g) || []).length,
      wordCount: content.split(/\s+/).length
    };
  }

  formatForUI(content) {
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>');

    return `<p>${formatted}</p>`;
  }
}

// src/ConversationManager.js
export class ConversationManager {
  constructor({ maxConversations = 1000 }) {
    this.conversations = new Map();
    this.maxConversations = maxConversations;
  }

  getConversation(conversationId) {
    return this.conversations.get(conversationId) || [];
  }

  addExchange(conversationId, exchange) {
    if (!this.conversations.has(conversationId)) {
      if (this.conversations.size >= this.maxConversations) {
        const firstKey = this.conversations.keys().next().value;
        this.conversations.delete(firstKey);
      }
      this.conversations.set(conversationId, []);
    }

    const conversation = this.conversations.get(conversationId);
    conversation.push({
      ...exchange,
      timestamp: new Date().toISOString()
    });
  }

  clearConversation(conversationId) {
    this.conversations.delete(conversationId);
  }

  getConversationStats(conversationId) {
    const conversation = this.getConversation(conversationId);
    return {
      exchanges: conversation.length,
      topics: [...new Set(conversation.map((entry) => entry.intent))],
      startTime: conversation[0]?.timestamp,
      lastActivity: conversation[conversation.length - 1]?.timestamp
    };
  }
}

// src/RankingEngine.js
export class RankingEngine {
  async rank({ results, query, intent, topK = 6 }) {
    const scored = results.map((result) => ({
      ...result,
      score: this.calculateRelevanceScore({
        result,
        query,
        intent
      })
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  calculateRelevanceScore({ result, query, intent }) {
    let score = 50;

    const titleMatch = this.calculateMatch(result.title || '', query);
    score += titleMatch * 20;

    const contentMatch = this.calculateMatch(result.content || '', query);
    score += contentMatch * 15;

    score += (result.credibility || 50) * 0.2;

    const authorityBonus = {
      academic: 15,
      reference: 12,
      news: 8,
      technical: 6,
      government: 10
    };
    score += authorityBonus[result.sourceType] || 0;

    if (intent === 'recent' && result.freshness !== 'archive') {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  calculateMatch(text, query) {
    const textLower = text.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);

    let matches = 0;
    queryTerms.forEach((term) => {
      if (textLower.includes(term)) {
        matches += 1;
      }
    });

    return matches / queryTerms.length;
  }
}

export default {
  SourceVerifier,
  ResponseBuilder,
  ConversationManager,
  RankingEngine
};
