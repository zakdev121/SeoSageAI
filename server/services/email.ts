import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure email transporter (using Gmail SMTP as example)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || ''
      }
    });
  }

  async sendAuditReport(
    recipientEmail: string,
    websiteUrl: string,
    pdfBuffer: Buffer,
    auditId: string
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'seo-agent@company.com',
        to: recipientEmail,
        subject: `SEO Audit Report - ${websiteUrl}`,
        html: this.generateEmailHTML(websiteUrl, auditId),
        attachments: [
          {
            filename: `seo-audit-${websiteUrl.replace(/https?:\/\//, '').replace(/[^\w]/g, '_')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  private generateEmailHTML(websiteUrl: string, auditId: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEO Audit Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #2563EB, #3B82F6);
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            margin-bottom: 20px;
          }
          h1 {
            color: #2563EB;
            margin: 0;
            font-size: 28px;
          }
          .website-url {
            color: #666;
            font-size: 18px;
            margin: 10px 0;
          }
          .content {
            margin: 30px 0;
          }
          .highlight {
            background: #eff6ff;
            border-left: 4px solid #2563EB;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .cta-button {
            display: inline-block;
            background: #2563EB;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #666;
            font-size: 14px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔍</div>
            <h1>SEO Audit Complete</h1>
            <div class="website-url">${websiteUrl}</div>
          </div>

          <div class="content">
            <p>Hello,</p>
            
            <p>Your comprehensive SEO audit has been completed! We've analyzed your website and identified key opportunities to improve your search engine rankings and organic traffic.</p>

            <div class="highlight">
              <strong>📊 What's Included:</strong>
              <ul>
                <li>Technical SEO analysis of your top pages</li>
                <li>Google Search Console performance data</li>
                <li>Keyword opportunity analysis</li>
                <li>AI-powered content recommendations</li>
                <li>Actionable next steps with priority levels</li>
              </ul>
            </div>

            <p>The detailed report is attached as a PDF. Please review the recommendations and feel free to reach out to the marketing team if you have any questions about implementation.</p>

            <div style="text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:5000'}/audit/${auditId}" class="cta-button">
                View Online Report
              </a>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the critical issues first (marked in red)</li>
              <li>Implement the high-priority AI recommendations</li>
              <li>Monitor your Search Console data for improvements</li>
              <li>Consider running another audit in 30-60 days</li>
            </ol>
          </div>

          <div class="footer">
            <p>This report was generated by <strong>SEO AI Agent</strong><br>
            Internal Marketing Tool</p>
            <p>Questions? Contact your marketing team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}
