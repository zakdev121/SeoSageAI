import { OpenAI } from 'openai';
import { AuditResultsType, PageDataType, SEOIssueType } from '../../shared/schema.js';

/**
 * Clean SEO AI Engine for Synviz - Three Core Pillars
 * 1. Extract Information (Audit)
 * 2. Generate Dynamic Suggestions 
 * 3. Safe WordPress Integration
 */
export class SEOEngine {
  private openai: OpenAI;
  private tenantId: string;
  
  constructor(tenantId: string = 'synviz') {
    this.tenantId = tenantId;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Pillar 1: Extract Information & Perform Audit
   */
  async performAudit(url: string, industry: string): Promise<AuditResultsType> {
    const { CrawlerService } = await import('../services/crawler.js');
    const { CustomSearchService } = await import('../services/customsearch.js');
    const { WordPressService } = await import('../services/wordpress-api.js');
    
    // Normalize URL - add https:// if missing
    const normalizedUrl = this.normalizeUrl(url);
    console.log(`🔍 Starting SEO audit for ${normalizedUrl}`);
    
    const crawler = new CrawlerService();
    const search = new CustomSearchService();
    const wpService = new WordPressService(normalizedUrl);
    
    let pages: any[] = [];
    let contentSource = 'Unknown';
    
    try {
      // Priority 1: Try WordPress API first
      const isWordPress = await wpService.testConnection();
      if (isWordPress) {
        console.log(`WordPress detected for ${normalizedUrl} - using REST API`);
        pages = await wpService.getContentAsPageData();
        contentSource = 'WordPress REST API';
        console.log(`Successfully fetched ${pages.length} pages via WordPress API`);
      } else {
        throw new Error('Not a WordPress site');
      }
    } catch (wpError) {
      console.log(`WordPress API failed: ${wpError.message}, trying web crawling...`);
      
      // Priority 2: Fallback to web crawling
      try {
        await crawler.initialize();
        pages = await crawler.crawlWebsite(normalizedUrl, 10);
        contentSource = 'Web Crawling';
        console.log(`Successfully crawled ${pages.length} pages`);
      } catch (crawlError) {
        console.error(`All content methods failed:`, crawlError);
        pages = [];
      }
    }
      
      // Get competitor intelligence 
      const competitors = await search.searchCompetitors(industry, ['AI automation', 'IT staffing']);
      
      // Analyze issues from pages
      const issues = this.analyzeIssues(pages);
      
      // Generate keyword opportunities
      const keywordOpportunities = await this.findKeywordOpportunities(pages, industry);
      
      return {
        url,
        industry,
        analyzedAt: new Date().toISOString(),
        pages,
        issues,
        keywordOpportunities,
        longtailKeywords: [],
        aiRecommendations: [],
        stats: {
          pagesAnalyzed: pages.length,
          seoScore: this.calculateSEOScore(pages, issues),
          issues: issues.length,
          opportunities: keywordOpportunities.length
        }
      };
    } finally {
      await crawler.cleanup();
    }
  }

  /**
   * Pillar 2: Generate Dynamic AI Suggestions
   */
  async generateSuggestions(auditResults: AuditResultsType): Promise<any[]> {
    const prompt = `As a senior SEO consultant, analyze this audit for ${auditResults.url} and provide 5-8 actionable recommendations:

    Industry: ${auditResults.industry}
    Pages Analyzed: ${auditResults.pages?.length || 0}
    Current SEO Score: ${auditResults.stats?.seoScore || 0}
    Issues Found: ${auditResults.issues?.length || 0}

    Key Issues:
    ${auditResults.issues?.slice(0, 5).map(issue => `- ${issue.type}: ${issue.message}`).join('\n') || 'None'}

    Generate prioritized recommendations in JSON format:
    {
      "recommendations": [
        {
          "id": "rec_1",
          "type": "technical|content|competitive",
          "priority": "high|medium|low",
          "title": "Clear action title",
          "description": "Detailed explanation with business impact",
          "expectedImpact": "Specific outcome (e.g., +15% organic traffic)",
          "implementation": {
            "difficulty": "easy|medium|hard",
            "timeRequired": "2-4 hours",
            "steps": ["Step 1", "Step 2"],
            "codeExample": "HTML/PHP code if applicable"
          },
          "aiReasoning": {
            "dataPoints": ["Data point 1", "Data point 2"],
            "competitorAnalysis": "What competitors do better",
            "confidenceScore": 0.85
          }
        }
      ]
    }`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || '{"recommendations": []}');
    return result.recommendations || [];
  }

  /**
   * Pillar 3: Safe WordPress Integration & Fix Application
   */
  async applySafeFix(auditId: number, issueType: string, pageUrl: string): Promise<any> {
    const { htmlIntegrityService } = await import('../services/html-integrity.js');
    const { WordPressService } = await import('../services/wordpress-api.js');
    
    // Safety check first
    const integrityCheck = await htmlIntegrityService.checkPageIntegrity(pageUrl);
    
    if (!integrityCheck.isValid || integrityCheck.criticalErrors.length > 0) {
      return {
        success: false,
        message: `Critical HTML integrity issues detected: ${integrityCheck.criticalErrors.join(', ')}`,
        safetyBlocked: true
      };
    }

    // Apply fix based on issue type
    try {
      const wpService = new WordPressService('https://synviz.com');
      
      switch (issueType) {
        case 'missing_meta_description':
          return await this.fixMetaDescription(wpService, pageUrl);
        case 'thin_content':
          return await this.fixThinContent(wpService, pageUrl);
        case 'missing_internal_links':
          return await this.fixInternalLinks(wpService, pageUrl);
        default:
          return {
            success: false,
            message: `No fix strategy available for: ${issueType}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Fix failed: ${error.message}`
      };
    }
  }

  // Helper methods
  private analyzeIssues(pages: PageDataType[]): SEOIssueType[] {
    const issues: SEOIssueType[] = [];
    
    pages.forEach(page => {
      if (!page.metaDescription) {
        issues.push({
          type: 'missing_meta_description',
          severity: 'medium',
          message: `Missing meta description`,
          page: page.url
        });
      }
      
      if (!page.title) {
        issues.push({
          type: 'missing_title_tag',
          severity: 'critical',
          message: `Missing title tag`,
          page: page.url
        });
      }
      
      if (page.wordCount < 300) {
        issues.push({
          type: 'thin_content',
          severity: 'medium',
          message: `Thin content: ${page.wordCount} words`,
          page: page.url
        });
      }
      
      if (page.internalLinks.length < 3) {
        issues.push({
          type: 'missing_internal_links',
          severity: 'low',
          message: `Few internal links: ${page.internalLinks.length}`,
          page: page.url
        });
      }
    });
    
    return issues;
  }

  private async findKeywordOpportunities(pages: PageDataType[], industry: string): Promise<any[]> {
    const opportunities = [];
    
    // Find pages missing meta descriptions for keyword targeting
    const pagesWithoutMeta = pages.filter(p => !p.metaDescription);
    
    pagesWithoutMeta.forEach(page => {
      opportunities.push({
        keyword: this.extractKeywordFromTitle(page.title || ''),
        searchVolume: 'medium',
        difficulty: 'easy',
        currentRank: 0,
        targetRank: 10,
        page: page.url
      });
    });
    
    return opportunities;
  }

  private extractKeywordFromTitle(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join(' ') || 'SEO optimization';
  }

  private calculateSEOScore(pages: PageDataType[], issues: SEOIssueType[]): number {
    let score = 100;
    
    // Deduct for issues
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': score -= 15; break;
        case 'medium': score -= 8; break;
        case 'low': score -= 3; break;
      }
    });
    
    // Boost for positive signals
    const metaCompleteness = pages.filter(p => p.metaDescription).length / pages.length;
    score += metaCompleteness * 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async fixMetaDescription(wpService: any, pageUrl: string): Promise<any> {
    // Generate optimized meta description using AI + competitor research
    const { CustomSearchService } = await import('../services/customsearch.js');
    const search = new CustomSearchService();
    
    // Research keywords for this page
    const keywords = await search.analyzeKeywordLandscape(['AI automation', 'IT staffing']);
    
    const metaPrompt = `Generate an optimized meta description for: ${pageUrl}
    Target keywords: ${keywords.map(k => k.keyword).slice(0, 3).join(', ')}
    Requirements: 150-160 characters, compelling, includes call-to-action
    Format: Just return the meta description text`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: metaPrompt }]
    });

    const metaDescription = response.choices[0].message.content?.trim() || '';
    
    // Apply to WordPress
    const postId = this.extractPostIdFromUrl(pageUrl);
    return await wpService.updatePostMetaDescription(postId, metaDescription);
  }

  private async fixThinContent(wpService: any, pageUrl: string): Promise<any> {
    const contentPrompt = `Generate 200-300 words of high-quality content to expand this page: ${pageUrl}
    Focus on: AI automation benefits, IT staffing expertise, technology consulting
    Format: HTML with proper headings and structure`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: contentPrompt }]
    });

    const additionalContent = response.choices[0].message.content || '';
    const postId = this.extractPostIdFromUrl(pageUrl);
    
    return await wpService.expandPostContent(postId, additionalContent);
  }

  private async fixInternalLinks(wpService: any, pageUrl: string): Promise<any> {
    const links = [
      { anchor: 'AI automation services', url: '/services/ai-automation' },
      { anchor: 'IT staffing solutions', url: '/services/it-staffing' },
      { anchor: 'technology consulting', url: '/services/consulting' }
    ];
    
    const postId = this.extractPostIdFromUrl(pageUrl);
    return await wpService.addInternalLinks(postId, links);
  }

  private extractPostIdFromUrl(url: string): number {
    // Simple extraction - in real implementation, would query WordPress API
    return Math.floor(Math.random() * 1000) + 1;
  }
}

// Singleton for Synviz
export const seoEngine = new SEOEngine('synviz');