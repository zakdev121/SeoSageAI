import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAuditSchema, AuditResults } from "@shared/schema";
import { CrawlerService } from "./services/crawler";
import { GSCService } from "./services/gsc";
import { KeywordService } from "./services/keywords";
import { AIService } from "./services/ai";
import { ReportService } from "./services/report";
// import { EmailService } from "./services/email"; // Disabled for now

export async function registerRoutes(app: Express): Promise<Server> {
  // Start SEO audit
  app.post("/api/audits", async (req, res) => {
    try {
      const validatedData = insertAuditSchema.parse(req.body);
      
      // Create audit record
      const audit = await storage.createAudit(validatedData);
      
      // Start background processing
      processAudit(audit.id, validatedData.url, validatedData.industry, validatedData.email);
      
      res.json({ auditId: audit.id, status: 'started' });
    } catch (error) {
      console.error('Error starting audit:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  });

  // Get audit status and results
  app.get("/api/audits/:id", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }
      
      res.json(audit);
    } catch (error) {
      console.error('Error fetching audit:', error);
      res.status(500).json({ error: 'Failed to fetch audit' });
    }
  });

  // Download PDF report
  app.get("/api/audits/:id/pdf", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const reportService = new ReportService();
      const pdfBuffer = await reportService.generatePDFReport(audit.results);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="seo-audit-${audit.url.replace(/https?:\/\//, '').replace(/[^\w]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Send email report
  app.post("/api/audits/:id/email", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      // Email functionality disabled
      res.status(501).json({ error: 'Email functionality is currently disabled' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Test OpenAI API endpoint
  app.get("/api/test/openai", async (req, res) => {
    try {
      const aiService = new AIService();
      const testResponse = await aiService.generateMetaDescriptions([{
        url: "https://example.com",
        title: "Test Page Title",
        metaDescription: undefined,
        h1: ["Main Heading"],
        h2: ["Secondary Heading"],
        wordCount: 300,
        images: [],
        internalLinks: [],
        externalLinks: [],
        brokenLinks: []
      }]);
      
      res.json({ 
        success: true, 
        message: "OpenAI API is working correctly",
        testResult: testResponse
      });
    } catch (error) {
      console.error('OpenAI test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "OpenAI API test failed"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processAudit(auditId: number, url: string, industry: string, email?: string) {
  const crawlerService = new CrawlerService();
  const gscService = new GSCService();
  const keywordService = new KeywordService();
  const aiService = new AIService();
  const reportService = new ReportService();
  // const emailService = new EmailService(); // Disabled for now

  try {
    // Update progress
    await storage.updateAuditProgress(auditId, 10);

    // Normalize URLs - ensure crawler gets full URL, GSC gets domain format
    const fullUrl = url.includes('://') ? url : `https://${url}`;
    const domainUrl = url.replace(/^https?:\/\//, '');

    // 1. Crawl website (up to 25 pages for comprehensive analysis)
    console.log(`Starting comprehensive crawl for ${fullUrl}`);
    const pages = await crawlerService.crawlWebsite(fullUrl, 25);
    await storage.updateAuditProgress(auditId, 30);

    // 2. Get GSC data
    console.log('Fetching GSC data...');
    const gscData = await gscService.getSearchConsoleData(domainUrl);
    await storage.updateAuditProgress(auditId, 50);

    // 3. Perform keyword research
    console.log('Performing keyword research...');
    const keywordData = await keywordService.performKeywordResearch(domainUrl, industry);
    await storage.updateAuditProgress(auditId, 70);

    // 4. Generate AI recommendations
    console.log('Generating AI recommendations...');
    const aiRecommendations = await aiService.generateRecommendations(
      pages, 
      keywordData.opportunities, 
      industry
    );
    await storage.updateAuditProgress(auditId, 85);

    // 5. Analyze and create issues list
    const issues = await analyzeIssues(pages);
    
    // 6. Calculate SEO score
    const seoScore = calculateSEOScore(pages, issues);

    // Compile results
    const results = AuditResults.parse({
      url,
      industry,
      analyzedAt: new Date().toISOString(),
      stats: {
        pagesAnalyzed: pages.length,
        seoScore,
        issues: issues.length,
        opportunities: keywordData.opportunities.length
      },
      pages,
      gscData: gscData || undefined,
      issues,
      keywordOpportunities: keywordData.opportunities,
      longtailKeywords: keywordData.longtailKeywords,
      aiRecommendations
    });

    // Save results
    await storage.completeAudit(auditId, results);
    await storage.updateAuditProgress(auditId, 100);

    // Send email if requested (COMMENTED OUT FOR NOW)
    // if (email) {
    //   console.log(`Sending email report to ${email}`);
    //   const pdfBuffer = await reportService.generatePDFReport(results);
    //   await emailService.sendAuditReport(email, url, pdfBuffer, auditId.toString());
    // }

    console.log(`Audit completed for ${url}`);
  } catch (error) {
    console.error(`Error processing audit ${auditId}:`, error);
    await storage.failAudit(auditId, error.message);
  } finally {
    // Cleanup services
    await crawlerService.cleanup();
    await keywordService.cleanup();
  }
}

async function analyzeIssues(pages: any[]) {
  const issues = [];

  for (const page of pages) {
    // Missing meta descriptions
    if (!page.metaDescription) {
      issues.push({
        type: 'Missing Meta Description',
        severity: 'critical' as const,
        message: `Page ${page.url} is missing a meta description`,
        page: page.url
      });
    }

    // Missing title
    if (!page.title) {
      issues.push({
        type: 'Missing Title Tag',
        severity: 'critical' as const,
        message: `Page ${page.url} is missing a title tag`,
        page: page.url
      });
    }

    // Long title tags
    if (page.title && page.title.length > 60) {
      issues.push({
        type: 'Long Title Tag',
        severity: 'medium' as const,
        message: `Page ${page.url} has a title tag that's ${page.title.length} characters (recommended: under 60)`,
        page: page.url
      });
    }

    // Missing H1
    if (page.h1.length === 0) {
      issues.push({
        type: 'Missing H1 Tag',
        severity: 'medium' as const,
        message: `Page ${page.url} is missing an H1 tag`,
        page: page.url
      });
    }

    // Multiple H1s
    if (page.h1.length > 1) {
      issues.push({
        type: 'Multiple H1 Tags',
        severity: 'low' as const,
        message: `Page ${page.url} has ${page.h1.length} H1 tags (recommended: 1)`,
        page: page.url
      });
    }

    // Missing alt text
    const missingAlt = page.images.filter((img: any) => !img.alt).length;
    if (missingAlt > 0) {
      issues.push({
        type: 'Missing Alt Text',
        severity: 'low' as const,
        message: `${missingAlt} images are missing alt text on ${page.url}`,
        page: page.url,
        count: missingAlt
      });
    }

    // Thin content
    if (page.wordCount < 300) {
      issues.push({
        type: 'Thin Content',
        severity: 'medium' as const,
        message: `Page ${page.url} has only ${page.wordCount} words (recommended: 300+)`,
        page: page.url
      });
    }
  }

  return issues;
}

function calculateSEOScore(pages: any[], issues: any[]): number {
  // Handle edge case of no pages crawled
  if (!pages || pages.length === 0) {
    console.log('SEO Score calculation: No pages crawled, returning minimum score');
    return 15; // Minimum score when no pages are available
  }
  
  let totalScore = 100;
  
  // Count issues by severity
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const lowIssues = issues.filter(i => i.severity === 'low').length;
  
  console.log(`SEO Score calculation: Critical: ${criticalIssues}, Medium: ${mediumIssues}, Low: ${lowIssues}`);
  
  // Calculate issue ratio per page for fairer scoring
  const totalPages = pages.length;
  const criticalRatio = criticalIssues / totalPages;
  const mediumRatio = mediumIssues / totalPages;
  const lowRatio = lowIssues / totalPages;
  
  // Deduct points based on issue density (more balanced for large audits)
  totalScore -= Math.min(30, criticalRatio * 50); // Cap critical deduction at 30
  totalScore -= Math.min(25, mediumRatio * 25);   // Cap medium deduction at 25
  totalScore -= Math.min(15, lowRatio * 15);      // Cap low deduction at 15
  
  // Award points for good practices
  const pagesWithTitles = pages.filter(p => p.title && p.title.trim().length > 0).length;
  const pagesWithMeta = pages.filter(p => p.metaDescription && p.metaDescription.trim().length > 0).length;
  const pagesWithH1 = pages.filter(p => p.h1 && p.h1.length > 0).length;
  
  const titleRatio = pagesWithTitles / totalPages;
  const metaRatio = pagesWithMeta / totalPages;
  const h1Ratio = pagesWithH1 / totalPages;
  
  // Award bonus points based on coverage
  totalScore += titleRatio * 10; // Up to 10 points for good titles
  totalScore += metaRatio * 8;   // Up to 8 points for meta descriptions  
  totalScore += h1Ratio * 5;     // Up to 5 points for H1 tags
  
  const finalScore = Math.max(15, Math.min(100, Math.round(totalScore))); // Minimum score of 15
  console.log(`Final SEO Score: ${finalScore} (Title coverage: ${Math.round(titleRatio*100)}%, Meta coverage: ${Math.round(metaRatio*100)}%, H1 coverage: ${Math.round(h1Ratio*100)}%)`);
  
  return finalScore;
}
