// src/SearchEngine.js
// Advanced parallel search engine with content extraction

import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import { tavily } from '@tavily/core';

class SearchEngine {
  constructor() {
    this.searchEndpoints = [
      {
        name: 'duckduckgo',
        baseUrl: 'https://html.duckduckgo.com/html/',
        paramName: 'q'
      }
    ];

    this.cache = new Map();
    this.requestDelay = 100; // ms between requests

    // Tavily configuration: use SEARCH_PROVIDER env var (auto|tavily|duckduckgo)
    // In "auto" mode, Tavily is used when TAVILY_API_KEY is set; otherwise DuckDuckGo.
    this.searchProvider = process.env.SEARCH_PROVIDER || 'auto';
    this.tavilyClient = null;

    if (this.searchProvider === 'tavily' && !process.env.TAVILY_API_KEY) {
      console.warn('SEARCH_PROVIDER=tavily but TAVILY_API_KEY is not set — falling back to DuckDuckGo');
    }

    if (process.env.TAVILY_API_KEY && this.searchProvider !== 'duckduckgo') {
      try {
        this.tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
      } catch (error) {
        console.error('Failed to initialize Tavily client:', error.message);
      }
    }
  }

  /**
   * Execute parallel searches across multiple queries and sources
   */
  async parallelSearch({ queries, depth = 1, resultsPerQuery = 8, timeContext = 'general' }) {
    const allResults = [];
    const startTime = Date.now();

    // Execute searches in parallel (with rate limiting)
    const searchPromises = queries.map(query => 
      this.executeSearch(query, depth, resultsPerQuery, timeContext)
    );

    const results = await Promise.allSettled(searchPromises);

    // Aggregate results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        allResults.push(...result.value);
      }
    });

    // Deduplicate by URL
    const uniqueResults = this.deduplicateResults(allResults);

    return {
      results: uniqueResults,
      totalTime: Date.now() - startTime,
      queryCount: queries.length,
      resultCount: uniqueResults.length,
      timeContext
    };
  }

  /**
   * Execute single search query
   */
  async executeSearch(query, depth, resultsPerQuery, timeContext) {
    const cacheKey = `search:${query}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Use SerpAPI for reliable results (requires API key in production)
      // For demo, we'll use a simulated search
      const results = await this.fetchSearchResults(query, resultsPerQuery, timeContext);

      // Extract content from top results
      // Tavily results already include content, so skip the extra HTTP scrape
      const enrichedResults = await Promise.all(
        results.slice(0, depth).map(result => {
          if (result.source === 'tavily') {
            return {
              ...result,
              content: result.snippet,
              wordCount: (result.snippet || '').split(/\s+/).length,
              extracted: false
            };
          }
          return this.extractContent(result);
        })
      );

      // Cache results
      this.cache.set(cacheKey, enrichedResults);

      return enrichedResults;
    } catch (error) {
      console.error(`Search error for "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Fetch search results using Tavily API
   */
  async tavilySearch(query, limit = 8, timeContext = 'general') {
    const options = {
      maxResults: limit,
      searchDepth: 'basic',
      topic: 'general',
    };

    if (timeContext === 'recent') {
      options.timeRange = 'month';
    }

    const response = await this.tavilyClient.search(query, options);

    return (response.results || []).map((result, index) => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.content || '',
      position: index + 1,
      source: 'tavily',
      timestamp: new Date(),
      credibility: this.estimateCredibility(result.url || '')
    }));
  }

  /**
   * Fetch search results (using fallback method)
   */
  async fetchSearchResults(query, limit = 8, timeContext = 'general') {
    // Use Tavily if available and provider allows it
    if (this.tavilyClient && this.searchProvider !== 'duckduckgo') {
      try {
        return await this.tavilySearch(query, limit, timeContext);
      } catch (error) {
        console.error(`Tavily search failed for "${query}":`, error.message);
        // Fall through to DuckDuckGo if provider is "auto"
        if (this.searchProvider === 'tavily') {
          return [];
        }
      }
    }

    const results = [];

    try {
      const params = new URLSearchParams({
        q: query,
        kl: 'us-en'
      });

      if (timeContext === 'recent') {
        params.set('df', 'm');
      }

      const response = await axios.post(this.searchEndpoints[0].baseUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });

      if (response.status === 200) {
        const $ = cheerioLoad(response.data);
        const resultElements = $('.result').slice(0, limit);

        resultElements.each((index, element) => {
          const linkElement = $(element).find('.result__title a').first();
          const snippetElement = $(element).find('.result__snippet').first();
          const title = linkElement.text().trim();
          const url = this.cleanUrl(linkElement.attr('href') || '');
          const snippet = snippetElement.text().trim();

          if (url && title) {
            results.push({
              title,
              url,
              snippet,
              position: index + 1,
              source: 'duckduckgo',
              timestamp: new Date(),
              credibility: this.estimateCredibility(url)
            });
          }
        });
      }
    } catch (error) {
      console.error(`Search fetch failed for "${query}":`, error.message);
    }

    return results;
  }

  /**
   * Extract main content from webpage
   */
  async extractContent(result) {
    try {
      const response = await axios.get(result.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      }).catch(() => ({ data: '' }));

      if (response.status !== 200) {
        return {
          ...result,
          content: result.snippet,
          wordCount: (result.snippet || '').split(/\s+/).length
        };
      }

      const $ = cheerioLoad(response.data);

      // Remove scripts and styles
      $('script, style').remove();

      // Extract main content
      let content = '';

      // Try to find main article content
      const selectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
        '.article-content',
        '.main-content',
        'body'
      ];

      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length) {
          content = element.text().trim();
          break;
        }
      }

      // Fallback: use paragraphs
      if (!content) {
        content = $('p').map((i, el) => $(el).text()).get().join(' ').slice(0, 2000);
      }

      // Clean content
      content = content
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);

      return {
        ...result,
        content: content || result.snippet,
        wordCount: content.split(/\s+/).length,
        extracted: content.length > 100
      };
    } catch (error) {
      return {
        ...result,
        content: result.snippet,
        wordCount: (result.snippet || '').split(/\s+/).length,
        error: error.message
      };
    }
  }

  /**
   * Clean and validate URL
   */
  cleanUrl(url) {
    if (!url) return '';

    try {
      if (url.startsWith('//')) {
        url = `https:${url}`;
      }

      const parsed = new URL(url, 'https://html.duckduckgo.com');
      const redirectTarget = parsed.searchParams.get('uddg');

      if (redirectTarget) {
        return decodeURIComponent(redirectTarget);
      }

      parsed.hash = '';
      return parsed.toString();
    } catch (error) {
      try {
        return decodeURIComponent(url);
      } catch (decodeError) {
        return url;
      }
    }
  }

  /**
   * Estimate source credibility
   */
  estimateCredibility(url) {
    const urlStr = typeof url === 'string' ? url.toLowerCase() : '';

    const scoring = {
      academic: { domains: ['edu', 'ac.', 'research', 'arxiv', 'doi.org'], score: 95 },
      authoritative: { domains: ['gov', 'wikipedia', 'britannica', 'nature.com', 'science.org'], score: 90 },
      established_media: { domains: ['bbc', 'guardian', 'economist', 'nyt', 'washington'], score: 85 },
      tech_reliable: { domains: ['techcrunch', 'wired', 'arstechnica', 'verge'], score: 80 },
      reputable_general: { domains: ['medium', 'forbes', 'cnbc', 'reuters'], score: 75 },
      blog: { domains: ['medium.com', 'substack', 'blog'], score: 60 },
      unknown: { domains: [], score: 50 }
    };

    for (const [category, { domains, score }] of Object.entries(scoring)) {
      if (domains.some(d => urlStr.includes(d))) {
        return score;
      }
    }

    return 50;
  }

  /**
   * Deduplicate results by URL
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    });
  }

  /**
   * Filter results by time context
   */
  filterByTimeContext(results, timeContext) {
    if (timeContext === 'general') return results;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (timeContext === 'recent') {
      return results.filter(r => new Date(r.timestamp) > thirtyDaysAgo);
    }

    return results;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default SearchEngine;
