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
    
    // Define synviz.com-specific competitor search queries for tech services & consulting
    const competitorQueries = [
      "AI automation consulting services",
      "tech staffing IT consulting services", 
      "technology consulting AI development"
    ];
    
    try {
      for (const query of competitorQueries) {
        const results = await this.performSearch(query);
        
        results.forEach((result, index) => {
          const domain = new URL(result.link).hostname;
          
          // Filter for tech services, AI consulting, and IT staffing competitors
          const knownCompetitors = [
            'accenture.com', 'deloitte.com', 'mckinsey.com', 'bcg.com', 'bain.com',
            'cognizant.com', 'infosys.com', 'tcs.com', 'wipro.com', 'hcl.com',
            'techsophy.com', 'slalom.com', 'boozallen.com', 'capgemini.com',
            'avanade.com', 'thoughtworks.com', 'epic.com', 'randstad.com',
            'adecco.com', 'manpowergroup.com', 'kellyservices.com', 'robert-half.com'
          ];
          
          const isKnownCompetitor = knownCompetitors.some(comp => domain.includes(comp));
          const hasRelevantContent = 
            result.title.toLowerCase().includes('consulting') ||
            result.title.toLowerCase().includes('staffing') ||
            result.title.toLowerCase().includes('ai services') ||
            result.title.toLowerCase().includes('technology consulting') ||
            result.title.toLowerCase().includes('it consulting') ||
            result.snippet.toLowerCase().includes('tech consulting') ||
            result.snippet.toLowerCase().includes('ai automation') ||
            result.snippet.toLowerCase().includes('technology services') ||
            result.snippet.toLowerCase().includes('it staffing') ||
            result.snippet.toLowerCase().includes('software consulting');
            
          const isRelevantCompetitor = isKnownCompetitor || hasRelevantContent;
            
          if (isRelevantCompetitor && !domain.includes('synviz.com')) {
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

      // If we don't have enough relevant competitors, add fallback known competitors
      if (uniqueCompetitors.length < 3) {
        const fallbackCompetitors: CompetitorData[] = [
          {
            domain: 'accenture.com',
            title: 'Accenture - Technology Consulting & AI Services',
            snippet: 'Leading technology consulting firm providing AI automation and digital transformation services.',
            ranking: 1
          },
          {
            domain: 'cognizant.com',
            title: 'Cognizant - IT Services & Consulting',
            snippet: 'Technology consulting and IT staffing services with expertise in AI and automation.',
            ranking: 2
          },
          {
            domain: 'thoughtworks.com',
            title: 'ThoughtWorks - Technology Consulting',
            snippet: 'Software consulting company specializing in agile development and technology solutions.',
            ranking: 3
          },
          {
            domain: 'slalom.com',
            title: 'Slalom - Technology Consulting',
            snippet: 'Modern consulting firm focused on strategy, technology, and business transformation.',
            ranking: 4
          }
        ];
        
        // Add fallback competitors that aren't already present
        fallbackCompetitors.forEach(fallback => {
          if (!uniqueCompetitors.some(c => c.domain === fallback.domain)) {
            uniqueCompetitors.push(fallback);
          }
        });
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
}