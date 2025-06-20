import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Trend Research Service - Real-time industry trend analysis
 * Searches multiple online sources for current trending topics
 */
export class TrendResearchService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for trend research");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Research current trends from multiple online sources
   */
  async researchTrends(industry: string, keywords: string[]): Promise<TrendInsight[]> {
    console.log(`Researching trends for: ${industry}`);
    
    const sources = [
      this.searchYCombinator(industry),
      this.searchTwitterTrends(industry, keywords),
      this.searchRedditTrends(industry, keywords),
      this.searchProductHunt(industry),
      this.searchStackOverflow(industry, keywords)
    ];

    const results = await Promise.allSettled(sources);
    const allTrends: TrendInsight[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allTrends.push(...result.value);
      }
    }

    // Use GPT to analyze and prioritize trends
    return await this.analyzeTrendsWithGPT(allTrends, industry);
  }

  /**
   * Search Y Combinator for startup trends and news
   */
  private async searchYCombinator(industry: string): Promise<TrendInsight[]> {
    try {
      const searchTerms = this.getIndustrySearchTerms(industry);
      const trends: TrendInsight[] = [];

      for (const term of searchTerms.slice(0, 2)) { // Limit to avoid rate limits
        const prompt = `
Search Y Combinator news and startup ecosystem for current trends related to "${term}" in ${industry}.

Based on recent Y Combinator batch companies, startup news, and industry developments, what are the top 3 trending topics that would make compelling blog content?

Consider:
- Recent YC startup launches
- Funding announcements
- New technologies being adopted
- Industry disruptions
- Emerging markets

Return as JSON: {"trends": [{"topic": "...", "description": "...", "relevance": "high/medium/low", "source": "YC/startup ecosystem"}]}
`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 800
        });

        const result = JSON.parse(response.choices[0].message.content || '{"trends": []}');
        trends.push(...(result.trends || []).map((trend: any) => ({
          ...trend,
          source: 'Y Combinator'
        })));
      }

      return trends;
    } catch (error) {
      console.error('Error searching Y Combinator:', error);
      return [];
    }
  }

  /**
   * Search Twitter/X for trending topics
   */
  private async searchTwitterTrends(industry: string, keywords: string[]): Promise<TrendInsight[]> {
    try {
      const searchTerms = [...this.getIndustrySearchTerms(industry), ...keywords];
      
      const prompt = `
Analyze current Twitter/X trends for ${industry} industry. 

Based on recent social media discussions, viral posts, and trending hashtags, what are the top 5 topics that are currently trending and would make engaging blog content?

Consider these keywords: ${searchTerms.join(', ')}

Focus on:
- Viral discussions and debates
- Breaking news and announcements
- Popular opinion threads
- Industry controversies or hot takes
- Emerging tools and technologies being discussed

Return as JSON: {"trends": [{"topic": "...", "description": "...", "relevance": "high/medium/low", "hashtags": ["#...", "#..."], "source": "Twitter/X"}]}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"trends": []}');
      return (result.trends || []).map((trend: any) => ({
        ...trend,
        source: 'Twitter/X'
      }));
    } catch (error) {
      console.error('Error searching Twitter trends:', error);
      return [];
    }
  }

  /**
   * Search Reddit for trending discussions
   */
  private async searchRedditTrends(industry: string, keywords: string[]): Promise<TrendInsight[]> {
    try {
      const subreddits = this.getIndustrySubreddits(industry);
      
      const prompt = `
Analyze current Reddit discussions in subreddits like ${subreddits.join(', ')} for ${industry} industry trends.

Based on popular Reddit posts, highly upvoted discussions, and active comment threads, what are the top 5 topics that would make compelling blog content?

Keywords to consider: ${keywords.join(', ')}

Focus on:
- Highly upvoted posts and discussions
- Controversial or debate-heavy topics
- "Ask" posts with high engagement
- Success stories and case studies
- Tool recommendations and comparisons
- Industry pain points and solutions

Return as JSON: {"trends": [{"topic": "...", "description": "...", "relevance": "high/medium/low", "subreddits": ["...", "..."], "source": "Reddit"}]}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1200
      });

      const result = JSON.parse(response.choices[0].message.content || '{"trends": []}');
      return (result.trends || []).map((trend: any) => ({
        ...trend,
        source: 'Reddit'
      }));
    } catch (error) {
      console.error('Error searching Reddit trends:', error);
      return [];
    }
  }

  /**
   * Search Product Hunt for trending products and launches
   */
  private async searchProductHunt(industry: string): Promise<TrendInsight[]> {
    try {
      const prompt = `
Analyze current Product Hunt launches and trending products for ${industry} industry.

Based on recent product launches, maker discussions, and highly voted products, what are the top 3 trending topics that would make great blog content?

Focus on:
- New product launches and their features
- Innovative solutions and approaches
- Maker stories and startup journeys
- Technology trends evident in new products
- Industry disruptions from new tools

Return as JSON: {"trends": [{"topic": "...", "description": "...", "relevance": "high/medium/low", "products": ["...", "..."], "source": "Product Hunt"}]}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content || '{"trends": []}');
      return (result.trends || []).map((trend: any) => ({
        ...trend,
        source: 'Product Hunt'
      }));
    } catch (error) {
      console.error('Error searching Product Hunt:', error);
      return [];
    }
  }

  /**
   * Search Stack Overflow for trending technical topics
   */
  private async searchStackOverflow(industry: string, keywords: string[]): Promise<TrendInsight[]> {
    try {
      const techKeywords = this.getTechnicalKeywords(industry);
      
      const prompt = `
Analyze current Stack Overflow trends for ${industry} industry.

Based on popular questions, trending tags, and high-engagement discussions, what are the top 3 technical topics that would make valuable blog content?

Keywords: ${[...techKeywords, ...keywords].join(', ')}

Focus on:
- Most asked questions and common problems
- Trending technologies and frameworks
- Popular tutorials and how-to discussions
- Performance and optimization topics
- Best practices and code reviews
- Tool comparisons and recommendations

Return as JSON: {"trends": [{"topic": "...", "description": "...", "relevance": "high/medium/low", "tags": ["...", "..."], "source": "Stack Overflow"}]}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content || '{"trends": []}');
      return (result.trends || []).map((trend: any) => ({
        ...trend,
        source: 'Stack Overflow'
      }));
    } catch (error) {
      console.error('Error searching Stack Overflow:', error);
      return [];
    }
  }

  /**
   * Use GPT to analyze and prioritize all collected trends
   */
  private async analyzeTrendsWithGPT(trends: TrendInsight[], industry: string): Promise<TrendInsight[]> {
    if (trends.length === 0) return [];

    const prompt = `
Analyze these trending topics collected from various sources for ${industry} industry:

${JSON.stringify(trends, null, 2)}

Prioritize and refine these trends based on:
1. Current relevance and timing
2. SEO potential and search volume
3. Audience engagement potential
4. Content uniqueness and value
5. Business impact and actionability

Return the top 8 most promising blog topics with:
- Enhanced descriptions
- Target audience insights
- Content angle suggestions
- SEO keyword opportunities

Return as JSON: {"prioritizedTrends": [{"topic": "...", "description": "...", "targetAudience": "...", "contentAngle": "...", "seoKeywords": ["...", "..."], "relevance": "high/medium/low", "source": "...", "priority": 1-8}]}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"prioritizedTrends": []}');
      return result.prioritizedTrends || trends.slice(0, 8);
    } catch (error) {
      console.error('Error analyzing trends with GPT:', error);
      return trends.slice(0, 8);
    }
  }

  /**
   * Get industry-specific search terms - handles comma-separated industries
   */
  private getIndustrySearchTerms(industryInput: string): string[] {
    const terms: Record<string, string[]> = {
      'tech': ['AI', 'machine learning', 'startup', 'SaaS', 'automation', 'blockchain', 'web3'],
      'marketing': ['digital marketing', 'SEO', 'content marketing', 'social media', 'analytics'],
      'finance': ['fintech', 'cryptocurrency', 'banking', 'investment', 'trading'],
      'healthcare': ['healthtech', 'telemedicine', 'medical devices', 'biotech'],
      'ecommerce': ['online retail', 'marketplace', 'dropshipping', 'fulfillment'],
      'service': ['consulting', 'professional services', 'business solutions', 'client management'],
      'default': ['technology', 'innovation', 'business', 'growth', 'strategy']
    };

    // Parse multiple industries from comma-separated string
    const industries = industryInput.split(',').map(i => i.trim().toLowerCase());
    const allTerms: string[] = [];

    for (const industry of industries) {
      const industryKey = Object.keys(terms).find(key => 
        industry.includes(key)
      ) || 'default';
      
      allTerms.push(...terms[industryKey]);
    }

    // Remove duplicates and return
    const uniqueTerms: string[] = [];
    for (const term of allTerms) {
      if (!uniqueTerms.includes(term)) {
        uniqueTerms.push(term);
      }
    }
    return uniqueTerms;
  }

  /**
   * Get industry-specific subreddits
   */
  private getIndustrySubreddits(industry: string): string[] {
    const subreddits: Record<string, string[]> = {
      'tech': ['r/programming', 'r/startups', 'r/entrepreneur', 'r/MachineLearning', 'r/webdev'],
      'marketing': ['r/marketing', 'r/SEO', 'r/digital_marketing', 'r/content_marketing'],
      'finance': ['r/fintech', 'r/investing', 'r/cryptocurrency', 'r/personalfinance'],
      'default': ['r/business', 'r/entrepreneur', 'r/technology', 'r/startups']
    };

    const industryKey = Object.keys(subreddits).find(key => 
      industry.toLowerCase().includes(key)
    ) || 'default';

    return subreddits[industryKey];
  }

  /**
   * Get technical keywords for Stack Overflow search
   */
  private getTechnicalKeywords(industry: string): string[] {
    const keywords: Record<string, string[]> = {
      'tech': ['javascript', 'python', 'react', 'nodejs', 'api', 'database', 'aws'],
      'marketing': ['analytics', 'tracking', 'automation', 'CRM', 'email marketing'],
      'finance': ['API', 'security', 'encryption', 'payment processing'],
      'default': ['programming', 'development', 'software', 'tools', 'integration']
    };

    const industryKey = Object.keys(keywords).find(key => 
      industry.toLowerCase().includes(key)
    ) || 'default';

    return keywords[industryKey];
  }
}

export interface TrendInsight {
  topic: string;
  description: string;
  relevance: 'high' | 'medium' | 'low';
  source: string;
  targetAudience?: string;
  contentAngle?: string;
  seoKeywords?: string[];
  hashtags?: string[];
  subreddits?: string[];
  tags?: string[];
  products?: string[];
  priority?: number;
}

export const trendResearch = new TrendResearchService();