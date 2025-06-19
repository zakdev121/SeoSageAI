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
    
    // Define synviz.com-specific competitor search queries
    const competitorQueries = [
      "Tableau Power BI Qlik data visualization",
      "business intelligence dashboard tools",
      "data analytics visualization platforms"
    ];
    
    try {
      for (const query of competitorQueries) {
        const results = await this.performSearch(query);
        
        results.forEach((result, index) => {
          const domain = new URL(result.link).hostname;
          
          // Filter for actual data visualization/BI competitors
          const knownCompetitors = [
            'tableau.com', 'powerbi.microsoft.com', 'qlik.com', 'looker.com',
            'sisense.com', 'domo.com', 'grafana.com', 'plotly.com', 'metabase.com',
            'chartio.com', 'mode.com', 'periscope.io', 'thoughtspot.com',
            'klipfolio.com', 'gooddata.com', 'pentaho.com', 'microstrategy.com'
          ];
          
          const isKnownCompetitor = knownCompetitors.some(comp => domain.includes(comp));
          const hasRelevantContent = 
            result.title.toLowerCase().includes('dashboard') ||
            result.title.toLowerCase().includes('visualization') ||
            result.title.toLowerCase().includes('analytics') ||
            result.title.toLowerCase().includes('business intelligence') ||
            result.snippet.toLowerCase().includes('data visualization') ||
            result.snippet.toLowerCase().includes('dashboard');
            
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
            domain: 'tableau.com',
            title: 'Tableau: Business Intelligence and Analytics',
            snippet: 'Tableau helps people see and understand data with powerful analytics and visualization tools.',
            ranking: 1
          },
          {
            domain: 'powerbi.microsoft.com',
            title: 'Microsoft Power BI - Data Visualization',
            snippet: 'Transform your company data into rich visuals for you to collect and organize.',
            ranking: 2
          },
          {
            domain: 'qlik.com',
            title: 'Qlik Sense - Modern Analytics Platform',
            snippet: 'Modern analytics platform that enables self-service visual analytics.',
            ranking: 3
          },
          {
            domain: 'looker.com',
            title: 'Looker - Business Intelligence Platform',
            snippet: 'Modern BI platform that delivers real-time business intelligence.',
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