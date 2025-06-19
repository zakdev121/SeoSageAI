import axios from 'axios';

export interface PageSpeedData {
  url: string;
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savings: number;
  }>;
  diagnostics: Array<{
    id: string;
    title: string;
    description: string;
    displayValue: string;
  }>;
}

export class PageSpeedService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
  }

  async analyzePerformance(url: string): Promise<PageSpeedData | null> {
    if (!this.apiKey) {
      console.warn('Google API key not provided for PageSpeed Insights');
      return null;
    }

    try {
      const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const response = await axios.get(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`,
        {
          params: {
            url: cleanUrl,
            key: this.apiKey,
            category: ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'],
            strategy: 'DESKTOP'
          }
        }
      );

      const data = response.data;
      const lighthouseResult = data.lighthouseResult;
      const categories = lighthouseResult.categories;
      const audits = lighthouseResult.audits;

      return {
        url: cleanUrl,
        performanceScore: Math.round(categories.performance.score * 100),
        accessibilityScore: Math.round(categories.accessibility.score * 100),
        bestPracticesScore: Math.round(categories['best-practices'].score * 100),
        seoScore: Math.round(categories.seo.score * 100),
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
        opportunities: this.extractOpportunities(audits),
        diagnostics: this.extractDiagnostics(audits)
      };
    } catch (error: any) {
      console.error('PageSpeed Insights API error:', error.message);
      return null;
    }
  }

  private extractOpportunities(audits: any): Array<any> {
    const opportunityIds = [
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'offscreen-images',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'efficient-animated-content',
      'duplicated-javascript'
    ];

    return opportunityIds
      .filter(id => audits[id] && audits[id].details && audits[id].details.overallSavingsMs > 0)
      .map(id => ({
        id,
        title: audits[id].title,
        description: audits[id].description,
        savings: Math.round(audits[id].details.overallSavingsMs / 1000 * 100) / 100
      }))
      .sort((a, b) => b.savings - a.savings);
  }

  private extractDiagnostics(audits: any): Array<any> {
    const diagnosticIds = [
      'total-byte-weight',
      'dom-size',
      'critical-request-chains',
      'main-thread-tasks',
      'bootup-time',
      'network-requests'
    ];

    return diagnosticIds
      .filter(id => audits[id])
      .map(id => ({
        id,
        title: audits[id].title,
        description: audits[id].description,
        displayValue: audits[id].displayValue || ''
      }));
  }
}