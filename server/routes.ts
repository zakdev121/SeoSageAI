import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAuditSchema, AuditResults } from "@shared/schema";
import { CrawlerService } from "./services/crawler";
import { GSCService } from "./services/gsc";
import { KeywordService } from "./services/keywords";
import { AIService } from "./services/ai";
import { EnhancedReportService } from "./services/enhanced-report";
import { PageSpeedService } from "./services/pagespeed";
import { CustomSearchService } from "./services/customsearch";
import { IssueResolverService } from "./services/issue-resolver";
import { BlogWriterService } from "./services/blog-writer";
import { WordPressService } from "./services/wordpress-api";
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
  app.get("/api/audits/:id/download", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const reportService = new EnhancedReportService();
      const pdfBuffer = await reportService.generatePDFReport(audit.results);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="seo-audit-${audit.url.replace(/https?:\/\//, '').replace(/[^\w]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Generate AI-powered issue resolutions
  app.get("/api/audits/:id/resolutions", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const issueResolver = new IssueResolverService();
      const resolutions = await issueResolver.generateIssueResolutions(audit.results);
      
      res.json(resolutions);
    } catch (error: any) {
      console.error('Error generating resolutions:', error);
      res.status(500).json({ error: 'Failed to generate resolutions' });
    }
  });

  // Generate blog strategy
  app.get("/api/audits/:id/blog-strategy", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const blogWriter = new BlogWriterService();
      const strategy = await blogWriter.generateBlogStrategy(audit.results);
      
      res.json(strategy);
    } catch (error: any) {
      console.error('Error generating blog strategy:', error);
      res.status(500).json({ error: 'Failed to generate blog strategy' });
    }
  });

  // Write a specific blog post
  app.post("/api/audits/:id/write-blog", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { topic } = req.body;
      
      if (!topic) {
        return res.status(400).json({ error: 'Blog topic is required' });
      }

      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const blogWriter = new BlogWriterService();
      const blogPost = await blogWriter.writeBlogPost(topic, audit.results);
      
      res.json({ blogPost });
    } catch (error: any) {
      console.error('Error writing blog post:', error);
      res.status(500).json({ error: 'Failed to write blog post' });
    }
  });

  // Generate content calendar
  app.post("/api/audits/:id/content-calendar", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { blogTopics } = req.body;
      
      if (!blogTopics || !Array.isArray(blogTopics)) {
        return res.status(400).json({ error: 'Blog topics array is required' });
      }

      const blogWriter = new BlogWriterService();
      const calendar = await blogWriter.generateContentCalendar(blogTopics);
      
      res.json(calendar);
    } catch (error: any) {
      console.error('Error generating content calendar:', error);
      res.status(500).json({ error: 'Failed to generate content calendar' });
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
    } catch (error: any) {
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

  // WordPress API routes for applying SEO fixes
  app.post("/api/audits/:id/apply-fix", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { fix } = req.body;
      
      const audit = await storage.getAudit(auditId);
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      const wpService = new WordPressService('https://synviz.com');
      const result = await wpService.applySEOFix(fix);
      
      res.json(result);
    } catch (error) {
      console.error('Error applying SEO fix:', error);
      res.status(500).json({ error: 'Failed to apply SEO fix' });
    }
  });

  app.post("/api/audits/:id/apply-fixes-batch", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { fixes } = req.body;
      
      const audit = await storage.getAudit(auditId);
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      const wpService = new WordPressService('https://synviz.com');
      const results = await wpService.batchApplyFixes(fixes);
      
      res.json({ results });
    } catch (error) {
      console.error('Error applying SEO fixes:', error);
      res.status(500).json({ error: 'Failed to apply SEO fixes' });
    }
  });

  app.get("/api/wordpress/test-connection", async (req, res) => {
    try {
      const wpService = new WordPressService('https://synviz.com');
      const isConnected = await wpService.testConnection();
      
      res.json({ 
        connected: isConnected,
        message: isConnected ? 'WordPress connection successful' : 'WordPress connection failed'
      });
    } catch (error) {
      console.error('WordPress connection test error:', error);
      res.status(500).json({ error: 'WordPress connection test failed' });
    }
  });

  app.get("/api/wordpress/all-content", async (req, res) => {
    try {
      const wpService = new WordPressService('https://synviz.com');
      const content = await wpService.getAllContent();
      
      res.json(content);
    } catch (error) {
      console.error('WordPress content fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch WordPress content' });
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
  const reportService = new EnhancedReportService();
  const pageSpeedService = new PageSpeedService();
  const customSearchService = new CustomSearchService();
  // const emailService = new EmailService(); // Disabled for now

  try {
    // Update progress
    await storage.updateAuditProgress(auditId, 10);

    // Normalize URLs - ensure crawler gets full URL, GSC gets domain format
    const fullUrl = url.includes('://') ? url : `https://${url}`;
    const domainUrl = url.replace(/^https?:\/\//, '');

    // 1. Crawl website (COMMENTED OUT FOR TESTING - FOCUS ON GSC/API DATA)
    console.log(`Skipping direct crawling - focusing on GSC and API analysis for ${fullUrl}`);
    let pages: any[] = [];
    
    // // Attempt full crawling with timeout for problematic domains
    // try {
    //   if (domainUrl.includes('synviz.com')) {
    //     console.log('Using GSC data for synviz.com analysis - skipping direct crawl due to IP restrictions');
    //     pages = [];
    //   } else {
    //     pages = await crawlerService.crawlWebsite(fullUrl, 25);
    //   }
    // } catch (error: any) {
    //   console.log(`Crawling failed for ${fullUrl}: ${error.message}`);
    //   pages = [];
    // }
    await storage.updateAuditProgress(auditId, 30);
    
    // If crawling failed due to network issues, create analysis from GSC data
    if (pages.length === 0) {
      console.log('Direct crawling failed, will analyze using GSC data and external insights');
    }

    // 2. Get GSC data
    console.log('Fetching GSC data...');
    const gscData = await gscService.getSearchConsoleData(domainUrl);
    await storage.updateAuditProgress(auditId, 50);

    // 3. Perform keyword research
    console.log('Performing keyword research...');
    const keywordData = await keywordService.performKeywordResearch(domainUrl, industry);
    await storage.updateAuditProgress(auditId, 70);

    // 4. Get PageSpeed Insights data
    console.log('Analyzing performance with PageSpeed Insights...');
    const pageSpeedData = await pageSpeedService.analyzePerformance(fullUrl);
    await storage.updateAuditProgress(auditId, 75);

    // 5. Analyze competitor landscape
    console.log('Analyzing competitor landscape...');
    const primaryKeywords = keywordData.opportunities.slice(0, 5).map(kw => kw.keyword);
    const competitors = await customSearchService.searchCompetitors(industry, primaryKeywords);
    const keywordLandscape = await customSearchService.analyzeKeywordLandscape(primaryKeywords);
    await storage.updateAuditProgress(auditId, 80);

    // 6. Generate AI recommendations
    console.log('Generating AI recommendations...');
    const aiRecommendations = await aiService.generateRecommendations(
      pages, 
      keywordData.opportunities, 
      industry
    );
    await storage.updateAuditProgress(auditId, 85);

    // 5. Generate GSC-based analysis when direct crawling fails
    let enhancedPages = pages;
    let gscBasedIssues: any[] = [];
    
    if (pages.length === 0 && gscData) {
      console.log('Generating SEO analysis from GSC performance data');
      // Create analysis based on GSC top pages data
      enhancedPages = gscData.topPages.map(page => ({
        url: page.page,
        title: `Page: ${page.page}`,
        metaDescription: '',
        h1: [],
        h2: [],
        wordCount: 0,
        images: [],
        internalLinks: [],
        externalLinks: [],
        brokenLinks: []
      }));
      
      // Generate GSC-based issues
      if (gscData.avgCTR < 2.0) {
        gscBasedIssues.push({
          type: 'Low Click-Through Rate',
          severity: 'medium' as const,
          message: `Average CTR is ${gscData.avgCTR.toFixed(2)}% (industry average: 2-5%)`,
          page: 'All pages'
        });
      }
      
      if (gscData.avgPosition > 10) {
        gscBasedIssues.push({
          type: 'Poor Average Rankings',
          severity: 'critical' as const,
          message: `Average search position is ${gscData.avgPosition.toFixed(1)} (aim for top 10)`,
          page: 'All pages'
        });
      }
    }
    
    // 6. Analyze and create issues list
    const directIssues = await analyzeIssues(enhancedPages);
    const issues = [...directIssues, ...gscBasedIssues];
    
    // 7. Calculate SEO score
    const seoScore = calculateSEOScore(enhancedPages, issues);

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
      aiRecommendations,
      pageSpeedData: pageSpeedData || undefined,
      competitors: competitors || undefined,
      keywordLandscape: keywordLandscape || undefined
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
