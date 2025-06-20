import axios from 'axios';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface CompetitorData {
  domain: string;
  title: string;
  snippet: string;
  ranking: number;
}

export class CustomSearchService {
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
  }

  async searchCompetitors(industry: string, primaryKeywords: string[]): Promise<CompetitorData[]> {
    if (!this.apiKey || !this.searchEngineId) {
      console.warn('Google Custom Search API credentials not provided');
      return [];
    }

    const competitors: CompetitorData[] = [];
    
    // Parse multiple industries from comma-separated string
    const industries = industry.split(',').map(i => i.trim().toLowerCase());
    
    // Generate industry-specific competitor search queries
    const competitorQueries = this.generateCompetitorQueries(industries, primaryKeywords);
    
    try {
      for (const query of competitorQueries) {
        const results = await this.performSearch(query);
        
        results.forEach((result, index) => {
          const domain = new URL(result.link).hostname;
          
          // Exclude large enterprises and focus on mid-market competitors
          const excludedDomains = [
            'accenture.com', 'deloitte.com', 'mckinsey.com', 'bcg.com', 'bain.com',
            'ibm.com', 'microsoft.com', 'google.com', 'amazon.com', 'meta.com',
            'cognizant.com', 'infosys.com', 'tcs.com', 'wipro.com', 'hcl.com',
            'boozallen.com', 'capgemini.com', 'ey.com', 'kpmg.com', 'pwc.com',
            'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com',
            'reddit.com', 'quora.com', 'stackoverflow.com', 'github.com'
          ];
          
          const isExcluded = excludedDomains.some(excluded => domain.includes(excluded));
          
          // Focus on mid-market competitors with relevant services
          const hasRelevantContent = this.isRelevantCompetitor(result, industries);
          const isMidMarket = this.appearsMidMarket(result);
            
          if (!isExcluded && hasRelevantContent && isMidMarket && !domain.includes('synviz.com')) {
            competitors.push({
              domain,
              title: result.title,
              snippet: result.snippet,
              ranking: index + 1
            });
          }
        });
      }

      // Deduplicate and return top competitors
      const uniqueCompetitors = Array.from(
        new Map(competitors.map(c => [c.domain, c])).values()
      );

      console.log('Found competitors:', uniqueCompetitors.map(c => c.domain));

      // If we don't have enough relevant competitors, search for more specific terms
      if (uniqueCompetitors.length < 3) {
        const additionalQueries = this.generateNicheCompetitorQueries(industries);
        
        for (const query of additionalQueries) {
          const results = await this.performSearch(query);
          
          results.forEach((result, index) => {
            const domain = new URL(result.link).hostname;
            const isExcluded = [
              'accenture.com', 'deloitte.com', 'mckinsey.com', 'bcg.com', 'bain.com',
              'ibm.com', 'microsoft.com', 'google.com', 'amazon.com', 'meta.com',
              'linkedin.com', 'indeed.com', 'glassdoor.com', 'reddit.com'
            ].some(excluded => domain.includes(excluded));
            
            if (!isExcluded && !domain.includes('synviz.com') && 
                !uniqueCompetitors.some(c => c.domain === domain)) {
              uniqueCompetitors.push({
                domain,
                title: result.title,
                snippet: result.snippet,
                ranking: index + 1
              });
            }
          });
          
          if (uniqueCompetitors.length >= 8) break;
        }
      }

      return uniqueCompetitors.slice(0, 8);
    } catch (error: any) {
      console.error('Custom Search API error:', error.message);
      return [];
    }
  }

  async analyzeKeywordLandscape(keywords: string[]): Promise<Array<{
    keyword: string;
    topDomains: string[];
    searchVolume: 'high' | 'medium' | 'low';
    competition: 'high' | 'medium' | 'low';
  }>> {
    if (!this.apiKey || !this.searchEngineId) {
      return [];
    }

    const landscape = [];

    try {
      for (const keyword of keywords.slice(0, 5)) {
        const results = await this.performSearch(keyword);
        const topDomains = results.slice(0, 5).map(r => new URL(r.link).hostname);
        
        landscape.push({
          keyword,
          topDomains,
          searchVolume: this.estimateSearchVolume(results.length),
          competition: this.estimateCompetition(topDomains)
        });
      }

      return landscape;
    } catch (error: any) {
      console.error('Keyword landscape analysis error:', error.message);
      return [];
    }
  }

  private async performSearch(query: string): Promise<SearchResult[]> {
    const response = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: query,
          num: 10
        }
      }
    );

    return response.data.items?.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink
    })) || [];
  }

  private estimateSearchVolume(resultCount: number): 'high' | 'medium' | 'low' {
    if (resultCount > 7) return 'high';
    if (resultCount > 4) return 'medium';
    return 'low';
  }

  private estimateCompetition(domains: string[]): 'high' | 'medium' | 'low' {
    const authorityDomains = ['wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com'];
    const authorityCount = domains.filter(d => authorityDomains.some(ad => d.includes(ad))).length;
    
    if (authorityCount > 2) return 'high';
    if (authorityCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Generate competitor search queries based on multiple industries
   */
  private generateCompetitorQueries(industries: string[], primaryKeywords: string[]): string[] {
    const queries: string[] = [];
    
    for (const industry of industries) {
      const cleanIndustry = industry.toLowerCase().trim();
      
      if (cleanIndustry.includes('tech') || cleanIndustry.includes('technology')) {
        queries.push(
          '"boutique technology consulting" services',
          '"mid-size tech consulting" firm', 
          '"custom software development" company',
          '"AI consulting" small business'
        );
      }
      
      if (cleanIndustry.includes('marketing') || cleanIndustry.includes('digital')) {
        queries.push(
          '"digital marketing agency" small business',
          '"boutique marketing" firm',
          '"marketing automation" consulting',
          '"SEO agency" mid-market'
        );
      }
    }
    
    return queries.slice(0, 6);
  }

  /**
   * Generate niche competitor queries for better targeting
   */
  private generateNicheCompetitorQueries(industries: string[]): string[] {
    const queries: string[] = [];
    
    for (const industry of industries) {
      const cleanIndustry = industry.toLowerCase().trim();
      
      if (cleanIndustry.includes('tech')) {
        queries.push(
          '"technology partners" -IBM -Microsoft -Google',
          '"software consultancy" -Accenture -Deloitte'
        );
      }
      
      if (cleanIndustry.includes('marketing')) {
        queries.push(
          '"marketing consultancy" -WPP -Omnicom',
          '"growth marketing" agency boutique'
        );
      }
    }
    
    return queries;
  }

  /**
   * Check if a search result represents a relevant competitor
   */
  private isRelevantCompetitor(result: SearchResult, industries: string[]): boolean {
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    
    const relevantTerms = ['consulting', 'services', 'agency', 'firm', 'solutions'];
    const hasRelevantTerms = relevantTerms.some(term => 
      titleLower.includes(term) || snippetLower.includes(term)
    );
    
    return hasRelevantTerms;
  }

  /**
   * Heuristics to identify mid-market companies vs large enterprises  
   */
  private appearsMidMarket(result: SearchResult): boolean {
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    
    const midMarketIndicators = ['boutique', 'specialized', 'custom', 'local', 'niche'];
    const enterpriseIndicators = ['global', 'worldwide', 'fortune', 'enterprise', 'leading'];
    
    const hasMidMarketSignals = midMarketIndicators.some(indicator => 
      titleLower.includes(indicator) || snippetLower.includes(indicator)
    );
    
    const hasEnterpriseSignals = enterpriseIndicators.some(indicator => 
      titleLower.includes(indicator) || snippetLower.includes(indicator)
    );
    
    return hasMidMarketSignals || !hasEnterpriseSignals;
  }
}