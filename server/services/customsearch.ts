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
    
    try {
      for (const keyword of primaryKeywords.slice(0, 3)) { // Limit to top 3 keywords
        const results = await this.performSearch(`${keyword} ${industry}`);
        
        results.forEach((result, index) => {
          const domain = new URL(result.link).hostname;
          competitors.push({
            domain,
            title: result.title,
            snippet: result.snippet,
            ranking: index + 1
          });
        });
      }

      // Deduplicate and return top competitors
      const uniqueCompetitors = Array.from(
        new Map(competitors.map(c => [c.domain, c])).values()
      );

      return uniqueCompetitors.slice(0, 10);
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