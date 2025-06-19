import { CrawlerService } from './crawler';
import { GSCService } from './gsc';
import { KeywordOpportunityType } from '@shared/schema';

export class KeywordService {
  private crawlerService: CrawlerService;
  private gscService: GSCService;

  constructor() {
    this.crawlerService = new CrawlerService();
    this.gscService = new GSCService();
  }

  async performKeywordResearch(siteUrl: string, industry: string): Promise<{
    opportunities: KeywordOpportunityType[];
    longtailKeywords: Array<{ keyword: string; volume: number; competition: 'low' | 'medium' | 'high' }>;
  }> {
    try {
      // Get GSC opportunity keywords
      const gscOpportunities = await this.gscService.getOpportunityKeywords(siteUrl);
      
      // Format opportunities
      const opportunities: KeywordOpportunityType[] = gscOpportunities.map(row => {
        const position = row.position || 0;
        const ctr = row.ctr || 0;
        const impressions = row.impressions || 0;
        
        let opportunity: 'high' | 'medium' | 'low' = 'low';
        if (position >= 10 && position <= 20 && impressions > 500) {
          opportunity = 'high';
        } else if (position >= 10 && position <= 30) {
          opportunity = 'medium';
        }

        return {
          keyword: row.keys?.[0] || '',
          position,
          impressions,
          clicks: row.clicks || 0,
          ctr: ctr * 100,
          opportunity,
          suggestions: []
        };
      });

      // Generate long-tail keyword suggestions
      const longtailKeywords = await this.generateLongtailKeywords(industry, opportunities.slice(0, 5));

      return {
        opportunities,
        longtailKeywords
      };
    } catch (error) {
      console.error('Error performing keyword research:', error);
      return {
        opportunities: [],
        longtailKeywords: []
      };
    }
  }

  private async generateLongtailKeywords(
    industry: string, 
    baseKeywords: KeywordOpportunityType[]
  ): Promise<Array<{ keyword: string; volume: number; competition: 'low' | 'medium' | 'high' }>> {
    const longtailKeywords = [];
    
    for (const baseKeyword of baseKeywords) {
      // Use Google Autosuggest to find variations
      const suggestions = await this.crawlerService.scrapeGoogleAutosuggest(baseKeyword.keyword);
      
      for (const suggestion of suggestions.slice(0, 3)) {
        if (suggestion.length > baseKeyword.keyword.length + 5) { // Only longer suggestions
          longtailKeywords.push({
            keyword: suggestion,
            volume: Math.floor(Math.random() * 200) + 50, // Simulated volume for now
            competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
          });
        }
      }
    }

    // Add industry-specific long-tail suggestions
    const industryModifiers = [
      'best', 'top', 'professional', 'affordable', 'near me', 'services', 
      'company', 'solutions', 'consulting', 'expert'
    ];

    const industryBase = industry.toLowerCase().replace(' ', ' ');
    for (const modifier of industryModifiers.slice(0, 5)) {
      longtailKeywords.push({
        keyword: `${modifier} ${industryBase}`,
        volume: Math.floor(Math.random() * 300) + 100,
        competition: ['low', 'medium'][Math.floor(Math.random() * 2)] as 'low' | 'medium'
      });
    }

    return longtailKeywords.slice(0, 20);
  }

  async cleanup() {
    await this.crawlerService.cleanup();
  }
}
