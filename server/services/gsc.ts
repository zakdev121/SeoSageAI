import { google } from 'googleapis';
import { GSCDataType } from '@shared/schema';

export class GSCService {
  private searchConsole: any;

  constructor() {
    try {
      const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!credentials || credentials === '{}') {
        console.log('Google Search Console credentials not provided - GSC features will be skipped');
        this.searchConsole = null;
        return;
      }

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
      });

      this.searchConsole = google.searchconsole({ version: 'v1', auth });
    } catch (error) {
      console.log('Failed to initialize Google Search Console - GSC features will be skipped');
      this.searchConsole = null;
    }
  }

  async getSearchConsoleData(siteUrl: string): Promise<GSCDataType | null> {
    if (!this.searchConsole) {
      return null;
    }
    
    try {
      // First, let's check what sites are available in GSC
      console.log('Checking available GSC sites...');
      const sitesResponse = await this.searchConsole.sites.list();
      console.log('Available GSC sites:', JSON.stringify(sitesResponse.data, null, 2));
      
      // Try to find the matching site URL
      const sites = sitesResponse.data.siteEntry || [];
      const matchingSite = sites.find(site => 
        site.siteUrl === siteUrl || 
        site.siteUrl === siteUrl.replace('https://', 'sc-domain:') ||
        site.siteUrl === `sc-domain:${siteUrl.replace('https://', '').replace('http://', '')}`
      );
      
      if (!matchingSite) {
        console.log(`Site ${siteUrl} not found in GSC. Available sites:`, sites.map(s => s.siteUrl));
        return null;
      }
      
      const gscSiteUrl = matchingSite.siteUrl;
      console.log(`Using GSC site URL: ${gscSiteUrl}`);
      
      const endDate = new Date();
      
      // Fetch 7-day data
      const startDate7Days = new Date();
      startDate7Days.setDate(startDate7Days.getDate() - 7);
      
      const performance7DaysResponse = await this.searchConsole.searchanalytics.query({
        siteUrl: gscSiteUrl,
        requestBody: {
          startDate: startDate7Days.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 100
        }
      });

      // Fetch 90-day data
      const startDate90Days = new Date();
      startDate90Days.setDate(startDate90Days.getDate() - 90);
      
      const performance90DaysResponse = await this.searchConsole.searchanalytics.query({
        siteUrl: gscSiteUrl,
        requestBody: {
          startDate: startDate90Days.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 100
        }
      });

      // Get page performance data (90 days for detailed analysis)
      const pageResponse = await this.searchConsole.searchanalytics.query({
        siteUrl: gscSiteUrl,
        requestBody: {
          startDate: startDate90Days.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['page'],
          rowLimit: 50
        }
      });

      const queryData7Days = performance7DaysResponse.data.rows || [];
      const queryData90Days = performance90DaysResponse.data.rows || [];
      const pageData = pageResponse.data.rows || [];

      // Calculate 7-day totals
      const totalClicks7Days = queryData7Days.reduce((sum, row) => sum + (row.clicks || 0), 0);
      const totalImpressions7Days = queryData7Days.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const avgCTR7Days = totalImpressions7Days > 0 ? (totalClicks7Days / totalImpressions7Days) * 100 : 0;
      const avgPosition7Days = queryData7Days.length > 0 
        ? queryData7Days.reduce((sum, row) => sum + (row.position || 0), 0) / queryData7Days.length 
        : 0;

      // Calculate 90-day totals
      const totalClicks90Days = queryData90Days.reduce((sum, row) => sum + (row.clicks || 0), 0);
      const totalImpressions90Days = queryData90Days.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const avgCTR90Days = totalImpressions90Days > 0 ? (totalClicks90Days / totalImpressions90Days) * 100 : 0;
      const avgPosition90Days = queryData90Days.length > 0 
        ? queryData90Days.reduce((sum, row) => sum + (row.position || 0), 0) / queryData90Days.length 
        : 0;

      // Format top queries (from 90-day data)
      const topQueries = queryData90Days.slice(0, 20).map(row => ({
        query: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? row.ctr * 100 : 0,
        position: row.position || 0
      }));

      // Format top pages
      const topPages = pageData.slice(0, 20).map(row => ({
        page: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? row.ctr * 100 : 0,
        position: row.position || 0
      }));

      return {
        // New time-period specific data
        last7Days: {
          totalClicks: totalClicks7Days,
          totalImpressions: totalImpressions7Days,
          avgCTR: Math.round(avgCTR7Days * 100) / 100,
          avgPosition: Math.round(avgPosition7Days * 100) / 100,
        },
        last90Days: {
          totalClicks: totalClicks90Days,
          totalImpressions: totalImpressions90Days,
          avgCTR: Math.round(avgCTR90Days * 100) / 100,
          avgPosition: Math.round(avgPosition90Days * 100) / 100,
        },
        // Legacy fields (use 90-day data for backward compatibility)
        totalClicks: totalClicks90Days,
        totalImpressions: totalImpressions90Days,
        avgCTR: Math.round(avgCTR90Days * 100) / 100,
        avgPosition: Math.round(avgPosition90Days * 100) / 100,
        topQueries,
        topPages
      };
    } catch (error) {
      console.error('Error fetching GSC data:', error);
      return null;
    }
  }

  async getOpportunityKeywords(siteUrl: string): Promise<any[]> {
    if (!this.searchConsole) {
      return [];
    }
    
    try {
      // Get the correct GSC site URL first
      const sitesResponse = await this.searchConsole.sites.list();
      const sites = sitesResponse.data.siteEntry || [];
      const matchingSite = sites.find((site: any) => 
        site.siteUrl === siteUrl || 
        site.siteUrl === siteUrl.replace('https://', 'sc-domain:') ||
        site.siteUrl === `sc-domain:${siteUrl.replace('https://', '').replace('http://', '')}`
      );
      
      if (!matchingSite) {
        console.log(`Site ${siteUrl} not found in GSC for opportunity keywords`);
        return [];
      }
      
      const gscSiteUrl = matchingSite.siteUrl;
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const response = await this.searchConsole.searchanalytics.query({
        siteUrl: gscSiteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 1000
        }
      });

      const rows = response.data.rows || [];
      
      // Filter for opportunity keywords (position 10-30 or high impressions with low CTR)
      return rows.filter(row => {
        const position = row.position || 0;
        const ctr = row.ctr || 0;
        const impressions = row.impressions || 0;
        
        return (position >= 10 && position <= 30) || (impressions > 100 && ctr < 0.05);
      }).slice(0, 50);
    } catch (error) {
      console.error('Error fetching opportunity keywords:', error);
      return [];
    }
  }
}
