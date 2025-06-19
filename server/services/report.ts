import puppeteer from 'puppeteer';
import { AuditResultsType } from '@shared/schema';

export class ReportService {
  async generatePDFReport(auditResults: AuditResultsType): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      const html = this.generateReportHTML(auditResults);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        }
      });

      return pdf;
    } finally {
      await browser.close();
    }
  }

  private generateReportHTML(results: AuditResultsType): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>SEO Audit Report - ${results.url}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #2563EB;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2563EB;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            margin: 10px 0;
            color: #666;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 30px 0;
          }
          .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #2563EB;
          }
          .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 5px;
          }
          .stat-label {
            color: #666;
            font-size: 14px;
          }
          .section {
            margin: 40px 0;
            page-break-inside: avoid;
          }
          .section h2 {
            color: #2563EB;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .issue {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .issue.warning {
            background: #fffbeb;
            border-left-color: #f59e0b;
          }
          .issue.info {
            background: #eff6ff;
            border-left-color: #3b82f6;
          }
          .recommendation {
            background: #f0f9ff;
            border-left: 4px solid #0ea5e9;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .table th,
          .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #374151;
          }
          .keyword-opportunity {
            background: #fef3c7;
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 4px solid #f59e0b;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SEO Audit Report</h1>
          <p><strong>${results.url}</strong></p>
          <p>Industry: ${results.industry} | Generated: ${new Date(results.analyzedAt).toLocaleDateString()}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${results.stats.pagesAnalyzed}</div>
            <div class="stat-label">Pages Analyzed</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${results.stats.seoScore}</div>
            <div class="stat-label">SEO Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${results.stats.issues}</div>
            <div class="stat-label">Issues Found</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${results.stats.opportunities}</div>
            <div class="stat-label">Opportunities</div>
          </div>
        </div>

        <div class="section">
          <h2>Executive Summary</h2>
          <p>This comprehensive SEO audit analyzed ${results.stats.pagesAnalyzed} pages of your website and identified ${results.stats.issues} issues that need attention, along with ${results.stats.opportunities} opportunities for improvement.</p>
          ${results.gscData ? `
            <p><strong>Search Console Data (Last 90 Days):</strong></p>
            <ul>
              <li>Total Clicks: ${results.gscData.totalClicks.toLocaleString()}</li>
              <li>Total Impressions: ${results.gscData.totalImpressions.toLocaleString()}</li>
              <li>Average CTR: ${results.gscData.avgCTR}%</li>
              <li>Average Position: ${results.gscData.avgPosition}</li>
            </ul>
          ` : ''}
        </div>

        <div class="section">
          <h2>Critical Issues</h2>
          ${results.issues.filter(issue => issue.severity === 'critical').map(issue => `
            <div class="issue">
              <strong>${issue.type}</strong><br>
              ${issue.message}
              ${issue.page ? `<br><small>Page: ${issue.page}</small>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>Page Analysis</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Title Length</th>
                <th>Meta Description</th>
                <th>Word Count</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              ${results.pages.map(page => `
                <tr>
                  <td>${page.url}</td>
                  <td>${page.title ? page.title.length : 'Missing'}</td>
                  <td>${page.metaDescription ? 'Present' : 'Missing'}</td>
                  <td>${page.wordCount}</td>
                  <td>
                    ${!page.title ? '• Missing Title ' : ''}
                    ${!page.metaDescription ? '• Missing Meta Description ' : ''}
                    ${page.h1.length === 0 ? '• No H1 Tag ' : ''}
                    ${page.h1.length > 1 ? '• Multiple H1 Tags ' : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Keyword Opportunities</h2>
          <p>These keywords are ranking in positions 10-30 and present opportunities for improvement:</p>
          ${results.keywordOpportunities.slice(0, 10).map(kw => `
            <div class="keyword-opportunity">
              <strong>${kw.keyword}</strong><br>
              Position: ${kw.position} | Impressions: ${kw.impressions} | Clicks: ${kw.clicks} | CTR: ${kw.ctr.toFixed(1)}%
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>AI-Powered Recommendations</h2>
          ${results.aiRecommendations.map(rec => `
            <div class="recommendation">
              <strong>${rec.title}</strong><br>
              ${rec.description}
              ${rec.targetKeyword ? `<br><small>Target Keyword: ${rec.targetKeyword}</small>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="footer">
          <p>This report was generated by SEO AI Agent - Internal Marketing Tool</p>
          <p>For questions about implementing these recommendations, contact your marketing team.</p>
        </div>
      </body>
      </html>
    `;
  }
}
