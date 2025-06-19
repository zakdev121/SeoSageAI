import puppeteer from 'puppeteer';
import { AuditResultsType } from '@shared/schema';

export class EnhancedReportService {
  async generatePDFReport(auditResults: AuditResultsType): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    try {
      const page = await browser.newPage();
      const html = this.generateEnhancedReportHTML(auditResults);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          bottom: '15mm',
          left: '15mm',
          right: '15mm'
        }
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private generateEnhancedReportHTML(results: AuditResultsType): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
    
    const criticalIssues = results.issues.filter(i => i.severity === 'critical');
    const mediumIssues = results.issues.filter(i => i.severity === 'medium');
    const topQueries = results.gscData?.topQueries?.slice(0, 10) || [];
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>SEO Report - ${results.url}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .cover-page {
            text-align: center;
            padding: 100px 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            page-break-after: always;
          }
          
          .cover-title {
            font-size: 48px;
            font-weight: 300;
            margin: 0 0 20px 0;
            letter-spacing: 2px;
          }
          
          .cover-date {
            font-size: 24px;
            margin: 20px 0 60px 0;
            font-weight: 300;
          }
          
          .cover-url {
            font-size: 28px;
            background: rgba(255,255,255,0.2);
            padding: 20px 40px;
            border-radius: 10px;
            margin: 40px 0;
            backdrop-filter: blur(10px);
          }
          
          .section-header {
            background: #f8fafc;
            padding: 30px 40px;
            margin: 0 0 30px 0;
            border-left: 6px solid #3b82f6;
          }
          
          .section-header h2 {
            font-size: 32px;
            margin: 0;
            color: #1e40af;
            font-weight: 600;
          }
          
          .content {
            padding: 0 40px 40px 40px;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 30px 0;
          }
          
          .metric-card {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          
          .metric-number {
            font-size: 36px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 8px;
          }
          
          .metric-label {
            color: #64748b;
            font-size: 14px;
            font-weight: 500;
          }
          
          .blog-section {
            background: #f0f9ff;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border-left: 4px solid #0ea5e9;
          }
          
          .gsc-performance {
            background: #fefce8;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
          }
          
          .performance-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .performance-table th {
            background: #1e40af;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
          }
          
          .performance-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .next-steps {
            background: #f0fdf4;
            padding: 30px;
            border-radius: 12px;
            margin: 30px 0;
            border-left: 4px solid #22c55e;
          }
          
          .next-steps h3 {
            color: #166534;
            margin-top: 0;
            font-size: 20px;
          }
          
          .next-steps ul {
            margin: 15px 0;
            padding-left: 20px;
          }
          
          .next-steps li {
            margin: 12px 0;
            line-height: 1.5;
            color: #374151;
          }
          
          .objectives {
            background: #fef3c7;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
          }
          
          .thank-you {
            text-align: center;
            padding: 60px 40px;
            background: #1e40af;
            color: white;
            margin-top: 50px;
            font-size: 36px;
            font-weight: 300;
            letter-spacing: 1px;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          .issue-item {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .issue-medium {
            border-left-color: #f59e0b;
          }
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        <div class="cover-page">
          <h1 class="cover-title">SEO REPORT</h1>
          <div class="cover-date">${currentDate.toUpperCase()}</div>
          <div class="cover-url">${results.url}</div>
        </div>
        
        <!-- SEO Health Section -->
        <div class="section-header">
          <h2>SEO Health</h2>
        </div>
        <div class="content">
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-number">${results.stats.seoScore}</div>
              <div class="metric-label">Overall SEO Score</div>
            </div>
            <div class="metric-card">
              <div class="metric-number">${criticalIssues.length}</div>
              <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric-card">
              <div class="metric-number">${mediumIssues.length}</div>
              <div class="metric-label">Medium Issues</div>
            </div>
          </div>
        </div>

        <!-- Published Blogs & SEO Section -->
        <div class="page-break"></div>
        <div class="section-header">
          <h2>Published Blogs & SEO</h2>
        </div>
        <div class="content">
          <div class="blog-section">
            <h3>● ${results.stats.pagesAnalyzed} pages analyzed and their complete On-Page SEO reviewed.</h3>
            <p>Comprehensive analysis performed on website structure, content optimization, and technical SEO elements.</p>
          </div>
        </div>

        <!-- Google Search Console Performance -->
        <div class="section-header">
          <h2>Google Search Console Performance</h2>
        </div>
        <div class="content">
          <div class="gsc-performance">
            ${results.gscData ? `
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-number">${results.gscData.totalClicks.toLocaleString()}</div>
                  <div class="metric-label">Total Clicks</div>
                </div>
                <div class="metric-card">
                  <div class="metric-number">${results.gscData.totalImpressions.toLocaleString()}</div>
                  <div class="metric-label">Total Impressions</div>
                </div>
                <div class="metric-card">
                  <div class="metric-number">${results.gscData.avgCTR.toFixed(2)}%</div>
                  <div class="metric-label">Average CTR</div>
                </div>
              </div>
              
              <h3>Top Performing Queries</h3>
              <table class="performance-table">
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Clicks</th>
                    <th>Impressions</th>
                    <th>CTR</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  ${topQueries.map(query => `
                    <tr>
                      <td>${query.query}</td>
                      <td>${query.clicks}</td>
                      <td>${query.impressions}</td>
                      <td>${query.ctr.toFixed(2)}%</td>
                      <td>${query.position.toFixed(1)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>Google Search Console data not available.</p>'}
          </div>
        </div>

        <!-- Reports Snapshot -->
        <div class="page-break"></div>
        <div class="section-header">
          <h2>Reports Snapshot</h2>
        </div>
        <div class="content">
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-number">${results.pageSpeedData?.performanceScore || 'N/A'}</div>
              <div class="metric-label">Performance Score</div>
            </div>
            <div class="metric-card">
              <div class="metric-number">${results.pageSpeedData?.seoScore || 'N/A'}</div>
              <div class="metric-label">PageSpeed SEO</div>
            </div>
            <div class="metric-card">
              <div class="metric-number">${results.stats.opportunities}</div>
              <div class="metric-label">Opportunities</div>
            </div>
          </div>
          
          <h3>Critical Issues to Address</h3>
          ${criticalIssues.map(issue => `
            <div class="issue-item">
              <strong>${issue.type}</strong><br>
              ${issue.message}
            </div>
          `).join('')}
          
          <h3>Medium Priority Issues</h3>
          ${mediumIssues.slice(0, 5).map(issue => `
            <div class="issue-item issue-medium">
              <strong>${issue.type}</strong><br>
              ${issue.message}
            </div>
          `).join('')}
        </div>

        <!-- Next Steps -->
        <div class="page-break"></div>
        <div class="section-header">
          <h2>Next Steps</h2>
        </div>
        <div class="content">
          <div class="next-steps">
            <h3>Immediate Actions Required</h3>
            <ul>
              <li>Continue working on keyword optimization and new content publishing in blog section</li>
              <li>Fix all issues related to page speed optimization</li>
              <li>Write Meta Descriptions for pages that do not meet the standards</li>
              <li>Write new Meta Descriptions for pages with duplicate meta descriptions</li>
              <li>Continue the submitted SEO Content Strategy to improve site content</li>
              <li>Optimize existing content with better keywords from submitted keyword research</li>
              <li>Fix Internal Links especially for pages that cannot be reached or are more than 3 clicks away from the homepage</li>
              <li>Optimize Important Pages that are not ranking</li>
            </ul>
          </div>
          
          <div class="objectives">
            <h3>Key Objectives Moving Forward</h3>
            <p>To ensure continued success and sustainable growth:</p>
            <ul>
              <li>Strengthening organic search visibility for targeted keywords</li>
              <li>Implementing advanced content and link-building strategies to boost domain authority</li>
              <li>Optimizing conversion rate strategies to increase traffic</li>
            </ul>
          </div>
        </div>

        <div class="thank-you">
          THANK YOU
        </div>
      </body>
      </html>
    `;
  }
}