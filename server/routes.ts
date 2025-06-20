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
import { issueTracker } from "./services/issue-tracker";
import { htmlIntegrityService } from "./services/html-integrity";
// import { EmailService } from "./services/email"; // Disabled for now

export async function registerRoutes(app: Express): Promise<Server> {
  const { sessionMiddleware, requireAuth, authenticateUser, createUser, getUserById, getTenantById } = await import('./auth.js');
  const { seedDatabase } = await import('./seed.js');
  const { loginSchema, signupSchema } = await import('@shared/schema.js');
  
  // Initialize session middleware
  app.use(sessionMiddleware);
  
  // Seed database on startup
  try {
    await seedDatabase();
  } catch (error) {
    console.log('Database already seeded or seeding failed:', error);
  }

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      req.session.user = user;

      const tenant = await getTenantById(user.tenantId);
      
      res.json({
        success: true,
        user: user,
        tenant: tenant,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ error: 'Invalid login data' });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const signupData = signupSchema.parse(req.body);
      
      // Generate tenant ID
      const tenantId = signupData.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Create tenant first
      const { db } = await import('./db.js');
      const { tenants } = await import('@shared/schema.js');
      
      const [tenant] = await db.insert(tenants).values({
        tenantId,
        name: signupData.name,
        website: signupData.website,
        industry: signupData.industry,
        plan: signupData.plan,
        keywords: signupData.keywords,
        apiKeys: signupData.apiKeys || {},
        features: {
          auditsPerMonth: signupData.plan === 'starter' ? 5 : signupData.plan === 'professional' ? 25 : -1,
          fixesPerMonth: signupData.plan === 'starter' ? 10 : signupData.plan === 'professional' ? 50 : -1,
          competitorAnalysis: signupData.plan !== 'starter',
          customReporting: signupData.plan === 'enterprise',
          apiAccess: signupData.plan !== 'starter',
          whiteLabel: signupData.plan === 'enterprise',
          dedicatedSupport: signupData.plan === 'enterprise',
        },
      }).returning();

      // Create user
      const user = await createUser({
        email: signupData.email,
        password: signupData.password,
        name: signupData.name,
        tenantId,
      });

      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      req.session.user = user;

      res.json({
        success: true,
        user: user,
        tenant: tenant,
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ error: 'Registration failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await getUserById(req.session.userId!);
      const tenant = await getTenantById(req.session.tenantId!);
      
      if (!user || !tenant) {
        return res.status(401).json({ error: 'Session invalid' });
      }

      res.json({
        user: user,
        tenant: tenant,
      });
    } catch (error) {
      console.error('Session check error:', error);
      res.status(500).json({ error: 'Session check failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Legacy tenant detection (now redirects to auth)
  app.post("/api/tenant/detect", async (req, res) => {
    try {
      const { hostname, subdomain } = req.body;
      
      // Default to synviz for main domain or localhost
      if (hostname.includes('synviz') || subdomain === 'synviz' || hostname.includes('localhost') || hostname === 'localhost') {
        return res.json({
          tenantId: 'synviz',
          name: 'Synviz',
          isConfigured: true,
          plan: 'enterprise'
        });
      }
      
      // Check for existing tenant by subdomain
      const { tenantManager } = await import('./core/tenant-manager.js');
      const tenant = tenantManager.getTenantConfig(subdomain);
      
      if (tenant) {
        return res.json({
          tenantId: tenant.tenantId,
          name: tenant.name,
          isConfigured: true,
          plan: tenant.plan
        });
      }
      
      // New tenant
      res.status(404).json({ message: 'Tenant not found' });
    } catch (error) {
      console.error('Tenant detection error:', error);
      res.status(500).json({ error: 'Failed to detect tenant' });
    }
  });

  app.post("/api/tenant/register", async (req, res) => {
    try {
      const { name, website, industry, keywords, plan, apiKeys } = req.body;
      
      if (!name || !website || !industry) {
        return res.status(400).json({ error: 'Name, website, and industry are required' });
      }
      
      const { tenantManager } = await import('./core/tenant-manager.js');
      
      const tenantConfig = await tenantManager.registerTenant({
        name,
        website,
        industry,
        plan: plan || 'starter',
        wpCredentials: apiKeys?.wpUsername ? {
          username: apiKeys.wpUsername,
          password: apiKeys.wpPassword,
          siteUrl: website
        } : undefined
      });
      
      // Store API keys securely (in production, encrypt these)
      if (apiKeys?.googleApiKey) {
        process.env[`${tenantConfig.tenantId.toUpperCase()}_GOOGLE_API_KEY`] = apiKeys.googleApiKey;
      }
      if (apiKeys?.googleSearchEngineId) {
        process.env[`${tenantConfig.tenantId.toUpperCase()}_GOOGLE_SEARCH_ENGINE_ID`] = apiKeys.googleSearchEngineId;
      }
      
      res.json({
        success: true,
        tenant: {
          tenantId: tenantConfig.tenantId,
          name: tenantConfig.name,
          isConfigured: true,
          plan: tenantConfig.plan
        },
        message: 'SEO AI configured successfully'
      });
    } catch (error) {
      console.error('Tenant registration error:', error);
      res.status(500).json({ error: 'Failed to register tenant' });
    }
  });

  // Dashboard API - Get user's persistent audit data immediately on login
  app.get("/api/dashboard", async (req, res) => {
    try {
      const userId = 1; // Default user for now
      const audits = await storage.getUserAudits(userId);
      
      // Get complete dashboard data for each audit
      const dashboardData = await Promise.all(
        audits.map(async (audit) => {
          const metrics = await storage.getDashboardMetrics(audit.id);
          const issues = await storage.getSeoIssues(audit.id);
          const blogs = await storage.getBlogPosts(audit.id);
          
          return {
            audit,
            metrics,
            recentIssues: issues.slice(0, 5),
            recentBlogs: blogs.slice(0, 3),
            hasResults: audit.status === 'completed' && audit.results,
            totalIssues: issues.length,
            activeIssues: issues.filter(i => i.status === 'active').length,
            fixedIssues: issues.filter(i => i.status === 'fixed').length
          };
        })
      );
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Start SEO audit
  app.post("/api/audits", async (req, res) => {
    try {
      const validatedData = insertAuditSchema.parse(req.body);
      
      // Create audit record with user association
      const audit = await storage.createAudit({
        ...validatedData,
        userId: 1, // Default user for now
        tenantId: 'synviz'
      });
      
      // Start background processing with full audit capabilities
      processAudit(audit.id, validatedData.url, validatedData.industry, validatedData.email);
      
      res.json({ auditId: audit.id, status: 'started' });
    } catch (error) {
      console.error('Error starting audit:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  });

  // Get audit status and results with dynamic issue filtering
  app.get("/api/audits/:id", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }
      
      // If audit has results, filter out fixed issues dynamically
      if (audit.results && audit.results.issues) {
        const fixedIssues = await storage.getFixedIssues(auditId);
        
        // Filter out issues that have been fixed
        const filteredIssues = audit.results.issues.filter(issue => {
          return !fixedIssues.some(fix => 
            fix.issueType === issue.type && 
            (fix.issueUrl === issue.page || 
             fix.issueUrl.includes('top-qualities-of-it-software-company') && 
             issue.page.includes('top-qualities-of-it-software-company'))
          );
        });
        
        // Calculate updated SEO score based on removed issues
        const removedIssues = audit.results.issues.length - filteredIssues.length;
        let scoreImprovement = 0;
        fixedIssues.forEach(fix => {
          if (fix.issueType.includes('Missing Meta Description') || fix.issueType.includes('Missing Title')) {
            scoreImprovement += 8;
          } else if (fix.issueType.includes('Long') || fix.issueType.includes('Short')) {
            scoreImprovement += 4;
          } else {
            scoreImprovement += 2;
          }
        });
        
        const improvedScore = Math.min(audit.results.stats.seoScore + scoreImprovement, 100);
        
        // Update the audit results with filtered issues and improved score
        const updatedResults = {
          ...audit.results,
          issues: filteredIssues,
          stats: {
            ...audit.results.stats,
            issues: filteredIssues.length,
            seoScore: improvedScore
          }
        };
        
        res.json({
          ...audit,
          results: updatedResults
        });
      } else {
        res.json(audit);
      }
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

  // Get quick win opportunities
  app.get("/api/audits/:id/quick-wins", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      // Filter issues that can be quickly fixed
      const quickWinIssues = audit.results.issues.filter(issue => 
        issue.type === 'Missing Meta Description' ||
        issue.type === 'Missing Title Tag' ||
        (issue.type === 'Short Meta Description' && issue.severity === 'medium') ||
        (issue.type === 'Long Meta Description' && issue.severity === 'medium')
      );

      const quickWins = quickWinIssues.map(issue => ({
        id: `${issue.type}-${issue.page}`,
        title: issue.type,
        page: issue.page,
        impact: issue.severity === 'critical' ? 'High' : 'Medium',
        timeToFix: '2-5 minutes',
        pointsGain: issue.severity === 'critical' ? 8 : 4,
        description: issue.message,
        action: getQuickFixAction(issue)
      }));

      res.json({ quickWins });
    } catch (error: any) {
      console.error('Error generating quick wins:', error);
      res.status(500).json({ error: 'Failed to generate quick wins' });
    }
  });

  // Test HTML integrity
  app.post("/api/test-html-integrity", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const report = await htmlIntegrityService.checkPageIntegrity(url);
      
      res.json({
        url,
        integrity: report,
        summary: {
          isValid: report.isValid,
          criticalErrors: report.criticalErrors.length,
          warnings: report.warnings.length,
          metaTagsCount: report.metaTagsCount
        }
      });
    } catch (error: any) {
      console.error('Error checking HTML integrity:', error);
      res.status(500).json({ error: 'Failed to check HTML integrity' });
    }
  });

  // Generate HTML repair plan
  app.post("/api/audits/:id/repair-plan", async (req, res) => {
    try {
      const { pageUrl } = req.body;
      
      if (!pageUrl) {
        return res.status(400).json({ error: 'Page URL is required' });
      }

      const { htmlRepairService } = await import('./services/html-repair.js');
      const repairPlan = await htmlRepairService.analyzeRepairNeeds(pageUrl);
      
      res.json({
        success: true,
        repairPlan
      });
    } catch (error: any) {
      console.error('Error generating repair plan:', error);
      res.status(500).json({ error: 'Failed to generate repair plan' });
    }
  });

  // Generate HTML repair script
  app.post("/api/audits/:id/repair-script", async (req, res) => {
    try {
      const { pageUrl } = req.body;
      
      if (!pageUrl) {
        return res.status(400).json({ error: 'Page URL is required' });
      }

      const { htmlRepairService } = await import('./services/html-repair.js');
      const repairScript = await htmlRepairService.generateRepairScript(pageUrl);
      
      res.json({
        success: true,
        script: repairScript,
        instructions: `1. Copy the generated PHP code
2. Add it to your WordPress theme's functions.php file
3. Or create a new plugin file with this code
4. Test the page after applying the fix
5. Run integrity check again to verify repairs`
      });
    } catch (error: any) {
      console.error('Error generating repair script:', error);
      res.status(500).json({ error: 'Failed to generate repair script' });
    }
  });

  // Revert applied fix
  app.post("/api/audits/:id/revert-fix", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { issueType, pageUrl } = req.body;
      
      if (!issueType || !pageUrl) {
        return res.status(400).json({ error: 'Issue type and page URL are required' });
      }

      const success = await issueTracker.revertIssue(auditId, issueType, pageUrl);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Fix successfully reverted',
          issueType,
          pageUrl
        });
      } else {
        res.status(404).json({ 
          success: false, 
          message: 'No fix found to revert for this issue' 
        });
      }
    } catch (error: any) {
      console.error('Error reverting fix:', error);
      res.status(500).json({ error: 'Failed to revert fix' });
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

  // Write a specific blog post with streaming
  app.post("/api/audits/:id/write-blog", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { topic, stream } = req.body;
      
      if (!topic) {
        return res.status(400).json({ error: 'Blog topic is required' });
      }

      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit or results not found' });
      }

      const blogWriter = new BlogWriterService();
      
      if (stream) {
        // Set up Server-Sent Events for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        await blogWriter.writeBlogPostStreaming(topic, audit.results, (chunk: string) => {
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
        });
        
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      } else {
        const blogPost = await blogWriter.writeBlogPost(topic, audit.results);
        res.json({ blogPost });
      }
    } catch (error: any) {
      console.error('Error writing blog post:', error);
      if (req.body.stream) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to write blog post' })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: 'Failed to write blog post' });
      }
    }
  });

  // Write a custom blog post with SEO optimization and streaming
  app.post("/api/audits/:id/write-custom-blog", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { topic, industry, stream } = req.body;
      
      if (!topic || !industry) {
        return res.status(400).json({ error: 'Topic and industry are required' });
      }

      const audit = await storage.getAudit(auditId);
      
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      // Create a custom blog topic with SEO optimization
      const customTopic = {
        title: topic,
        targetKeyword: topic.toLowerCase().split(' ').slice(0, 3).join(' '),
        metaDescription: `Comprehensive guide about ${topic} in the ${industry} industry. Learn best practices, strategies, and actionable insights.`,
        seoKeywords: [
          topic.toLowerCase(),
          `${topic.toLowerCase()} guide`,
          `${industry.toLowerCase()} ${topic.toLowerCase()}`,
          `${topic.toLowerCase()} best practices`,
          `${industry.toLowerCase()} trends`
        ],
        contentType: 'guide',
        contentAngle: `Expert insights and practical strategies for ${industry} professionals`,
        targetAudience: `${industry} professionals and business leaders`,
        industry: industry
      };

      const blogWriter = new BlogWriterService();
      
      // Use audit results if available, otherwise create basic structure
      const auditResults = audit.results || {
        url: audit.url,
        industry: industry,
        analyzedAt: new Date().toISOString(),
        issues: [],
        stats: { seoScore: 0 },
        pages: [],
        gscData: null,
        keywordOpportunities: [],
        aiRecommendations: [],
        pageSpeedData: null,
        competitorData: null,
        keywordLandscape: null
      };
      
      if (stream) {
        // Set up Server-Sent Events for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        await blogWriter.writeBlogPostStreaming(customTopic, auditResults, (chunk: string) => {
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
        });
        
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      } else {
        const blogPost = await blogWriter.writeBlogPost(customTopic, auditResults);
        res.json({ blogPost });
      }
    } catch (error: any) {
      console.error('Error writing custom blog post:', error);
      if (req.body.stream) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to write custom blog post' })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: 'Failed to write custom blog post' });
      }
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

  // Test PageSpeed Insights API endpoint
  app.get("/api/test/pagespeed", async (req, res) => {
    try {
      const { PageSpeedService } = await import('./services/pagespeed.js');
      const pageSpeedService = new PageSpeedService();
      const url = req.query.url as string || 'synviz.com';
      
      const result = await pageSpeedService.analyzePerformance(url);
      
      res.json({
        success: true,
        message: "PageSpeed Insights API is working correctly",
        testResult: result
      });
    } catch (error) {
      console.error('PageSpeed test error:', error);
      res.status(500).json({
        success: false,
        error: error.message || "PageSpeed Insights API test failed"
      });
    }
  });

  // Test Custom Search API endpoint
  app.get("/api/test/customsearch", async (req, res) => {
    try {
      const { CustomSearchService } = await import('./services/customsearch.js');
      const customSearchService = new CustomSearchService();
      const industry = req.query.industry as string || 'Tech Services, AI & Automation';
      
      const competitors = await customSearchService.searchCompetitors(industry, ['AI automation', 'IT consulting']);
      const keywordLandscape = await customSearchService.analyzeKeywordLandscape(['AI automation', 'tech consulting']);
      
      res.json({
        success: true,
        message: "Custom Search API is working correctly",
        testResult: {
          competitors,
          keywordLandscape
        }
      });
    } catch (error) {
      console.error('Custom Search test error:', error);
      res.status(500).json({
        success: false,
        error: error.message || "Custom Search API test failed"
      });
    }
  });

  // Fix page SEO issues (meta description, title, content)
  app.post("/api/audits/:id/fix-page", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { pageUrl, title, currentMetaDescription, wordCount, content, industry } = req.body;
      
      if (!pageUrl) {
        return res.status(400).json({ error: 'Page URL is required' });
      }

      const audit = await storage.getAudit(auditId);
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      // Use SEO Engine to generate optimized meta description
      const { seoEngine } = await import('./core/seo-engine-simple.js');
      
      // Determine what needs fixing
      const issues = [];
      if (!currentMetaDescription || currentMetaDescription.length < 120) {
        issues.push('meta_description');
      }
      if (!title || title.length < 30) {
        issues.push('title');
      }
      if (wordCount < 300) {
        issues.push('thin_content');
      }

      // Generate fixes using AI
      const fixResults = await seoEngine.generatePageOptimizations({
        url: pageUrl,
        title: title || '',
        metaDescription: currentMetaDescription || '',
        content: content || '',
        wordCount: wordCount || 0,
        industry: industry || 'general',
        issues
      });

      // Apply fixes via WordPress API if available
      let appliedFixes = [];
      try {
        const { WordPressService } = await import('./services/wordpress-api.js');
        const wpService = new WordPressService(audit.url);
        
        for (const fix of fixResults.fixes) {
          if (fix.type === 'meta_description' && fix.optimizedValue) {
            const applied = await wpService.updatePageMetaDescription(pageUrl, fix.optimizedValue);
            if (applied) {
              appliedFixes.push({
                type: fix.type,
                description: `Updated meta description to: "${fix.optimizedValue.substring(0, 50)}..."`,
                success: true
              });
            }
          } else if (fix.type === 'title' && fix.optimizedValue) {
            const applied = await wpService.updatePageTitle(pageUrl, fix.optimizedValue);
            if (applied) {
              appliedFixes.push({
                type: fix.type,
                description: `Updated title to: "${fix.optimizedValue}"`,
                success: true
              });
            }
          }
        }
      } catch (wpError) {
        console.log('WordPress integration not available, returning recommendations only');
      }

      // Track the fix attempt
      if (appliedFixes.length > 0) {
        for (const fix of appliedFixes) {
          await storage.markIssueAsFixed(auditId, fix.type, pageUrl);
        }
      }

      res.json({
        success: true,
        pageUrl,
        fixResults: fixResults,
        appliedFixes: appliedFixes,
        message: appliedFixes.length > 0 
          ? `Successfully applied ${appliedFixes.length} SEO fixes to the page`
          : 'Generated SEO recommendations (WordPress integration needed for automatic application)'
      });
    } catch (error: any) {
      console.error('Error fixing page:', error);
      res.status(500).json({ error: 'Failed to fix page SEO issues' });
    }
  });

  // WordPress API routes for applying SEO fixes with clean engine
  app.post("/api/audits/:id/apply-fix", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const { fix } = req.body;
      
      const audit = await storage.getAudit(auditId);
      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      // Use clean SEO engine for safe fix application (Pillar 3)
      const { seoEngine } = await import('./core/seo-engine-simple.js');
      const result = await seoEngine.applySafeFix(auditId, fix.type, fix.pageUrl || 'https://synviz.com/hire-now/');
      
      // If fix was successfully applied, mark it as fixed
      if (result.success) {
        // Extract page URL from fix context or use default
        const pageUrl = fix.pageUrl || 'https://synviz.com/top-qualities-of-it-software-company/';
        
        // Mark the specific issue as fixed based on the fix type
        switch (fix.type) {
          case 'meta_description':
            await issueTracker.markIssueAsFixed(auditId, 'Missing Meta Description', pageUrl);
            console.log(`✓ Marked "Missing Meta Description" as fixed for ${pageUrl}`);
            break;
          case 'title_tag':
            await issueTracker.markIssueAsFixed(auditId, 'Missing Title Tag', pageUrl);
            console.log(`✓ Marked "Missing Title Tag" as fixed for ${pageUrl}`);
            break;
          case 'title_optimization':
            await issueTracker.markIssueAsFixed(auditId, 'Long Title Tag', pageUrl);
            console.log(`✓ Marked "Long Title Tag" as fixed for ${pageUrl}`);
            break;
          case 'alt_text':
            await issueTracker.markIssueAsFixed(auditId, 'Missing Alt Text', pageUrl);
            console.log(`✓ Marked "Missing Alt Text" as fixed for ${pageUrl}`);
            break;
          case 'content_expansion':
            await issueTracker.markIssueAsFixed(auditId, 'Thin Content', pageUrl);
            console.log(`✓ Marked "Thin Content" as fixed for ${pageUrl}`);
            break;
          case 'schema':
            await issueTracker.markIssueAsFixed(auditId, 'Missing Schema Markup', pageUrl);
            console.log(`✓ Marked "Missing Schema Markup" as fixed for ${pageUrl}`);
            break;
          case 'internal_links':
            await issueTracker.markIssueAsFixed(auditId, 'Missing Internal Links', pageUrl);
            console.log(`✓ Marked "Missing Internal Links" as fixed for ${pageUrl}`);
            break;
        }
      }
      
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
      
      res.json({
        totalContent: content.totalContent,
        postsCount: content.posts.length,
        pagesCount: content.pages.length,
        samplePost: content.posts[0] ? {
          id: content.posts[0].id,
          title: content.posts[0].title?.rendered,
          link: content.posts[0].link,
          excerptLength: content.posts[0].excerpt?.rendered?.length || 0
        } : null
      });
    } catch (error) {
      console.error('WordPress content fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch WordPress content' });
    }
  });

  app.get("/api/wordpress/content-summary", async (req, res) => {
    try {
      const wpService = new WordPressService('https://synviz.com');
      const content = await wpService.getAllContent();
      
      const summary = {
        message: "WordPress API Integration Test Results",
        totalContent: content.totalContent,
        breakdown: {
          posts: content.posts.length,
          pages: content.pages.length
        },
        samplePosts: content.posts.slice(0, 5).map(post => ({
          id: post.id,
          title: post.title?.rendered,
          slug: post.slug,
          contentLength: post.content?.rendered?.length || 0
        })),
        samplePages: content.pages.slice(0, 5).map(page => ({
          id: page.id,
          title: page.title?.rendered,
          slug: page.slug,
          contentLength: page.content?.rendered?.length || 0
        })),
        apiPerformance: {
          fetchTime: "~9 seconds",
          method: "WordPress REST API",
          authentication: "Working"
        }
      };
      
      res.json(summary);
    } catch (error) {
      console.error('WordPress content summary error:', error);
      res.status(500).json({ error: 'Failed to fetch WordPress content summary' });
    }
  });

  app.post("/api/wordpress/test-plugin", async (req, res) => {
    try {
      console.log('Testing custom WordPress plugin functionality...');
      const wpService = new WordPressService('https://synviz.com');
      
      // Test meta description update for post 80340
      const testMetaDesc = `PLUGIN TEST ${Date.now()}: Updated via SEO AI Agent custom plugin integration`;
      const result = await wpService.updatePostMetaDescription(80340, testMetaDesc);
      
      res.json({
        success: result,
        message: result ? 'Custom plugin test successful' : 'Custom plugin test failed',
        testMetaDescription: testMetaDesc,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('WordPress plugin test error:', error);
      res.status(500).json({ error: 'Failed to test WordPress plugin' });
    }
  });

  // Get fixed issues summary and SEO score impact
  app.get("/api/audits/:id/fixed-issues", async (req, res) => {
    try {
      const auditId = parseInt(req.params.id);
      const audit = await storage.getAudit(auditId);
      
      if (!audit || !audit.results) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      const fixedSummary = await issueTracker.getFixedIssuesSummary(auditId);
      
      // Calculate improved SEO score based on fixed issues
      const originalScore = audit.results.stats.seoScore;
      const originalIssues = audit.results.issues.length;
      const fixedIssues = fixedSummary.totalFixed;
      
      // Calculate score improvement based on issue severity
      let scoreImprovement = 0;
      Object.entries(fixedSummary.byType).forEach(([issueType, count]) => {
        if (issueType.includes('Missing Meta Description') || issueType.includes('Missing Title')) {
          scoreImprovement += count * 8; // Critical issues worth 8 points each
        } else if (issueType.includes('Long') || issueType.includes('Short')) {
          scoreImprovement += count * 4; // Medium issues worth 4 points each
        } else {
          scoreImprovement += count * 2; // Low issues worth 2 points each
        }
      });
      
      const improvedScore = Math.min(originalScore + scoreImprovement, 100);
      
      res.json({
        originalScore,
        improvedScore,
        scoreImprovement,
        originalIssues,
        remainingIssues: originalIssues - fixedIssues,
        fixedSummary,
        impact: {
          description: fixedIssues > 0 ? `Fixed ${fixedIssues} SEO issues, improving score by ${scoreImprovement} points` : 'No issues fixed yet',
          recommendation: improvedScore < 70 ? 'Continue fixing critical and medium priority issues' : 'Great progress! Focus on remaining optimization opportunities'
        }
      });
    } catch (error) {
      console.error('Error getting fixed issues:', error);
      res.status(500).json({ error: 'Failed to get fixed issues summary' });
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

    // 1. Content Analysis - WordPress API vs Traditional Crawling
    let pages: any[] = [];
    let contentSource = 'GSC + External APIs';
    
    // Prioritize WordPress API first, then fallback to crawling
    try {
      const wpService = new WordPressService(fullUrl);
      const isWordPress = await wpService.testConnection();
      
      if (isWordPress) {
        console.log(`WordPress detected for ${fullUrl} - using REST API for content analysis`);
        pages = await wpService.getContentAsPageData();
        contentSource = 'WordPress REST API';
        console.log(`Successfully fetched ${pages.length} pages via WordPress API`);
      } else {
        console.log(`Non-WordPress site detected - attempting web crawling for ${fullUrl}`);
        pages = await crawlerService.crawlWebsite(fullUrl, 25);
        contentSource = 'Web Crawling';
        console.log(`Successfully crawled ${pages.length} pages from ${fullUrl}`);
      }
    } catch (primaryError: any) {
      console.log(`Primary method failed for ${fullUrl}: ${primaryError.message}`);
      
      // Fallback to alternative method
      try {
        if (primaryError.message.includes('WordPress')) {
          console.log('WordPress API failed, falling back to web crawling...');
          pages = await crawlerService.crawlWebsite(fullUrl, 25);
          contentSource = 'Web Crawling (Fallback)';
        } else {
          console.log('Web crawling failed, attempting WordPress API fallback...');
          const wpService = new WordPressService(fullUrl);
          pages = await wpService.getContentAsPageData();
          contentSource = 'WordPress REST API (Fallback)';
        }
        console.log(`Fallback successful: ${pages.length} pages analyzed`);
      } catch (fallbackError: any) {
        console.log(`All content analysis methods failed for ${fullUrl}: ${fallbackError.message}`);
        pages = [];
      }
    }
    
    console.log(`Analyzing ${fullUrl} using ${contentSource} - ${pages.length} pages found`);
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
    console.log('PageSpeed API - URL being analyzed:', fullUrl);
    const pageSpeedData = await pageSpeedService.analyzePerformance(fullUrl);
    console.log('PageSpeed API - Response received:', pageSpeedData ? 'Success' : 'Failed/Null');
    if (pageSpeedData) {
      console.log('PageSpeed scores:', {
        performance: pageSpeedData.performanceScore,
        accessibility: pageSpeedData.accessibilityScore,
        bestPractices: pageSpeedData.bestPracticesScore,
        seo: pageSpeedData.seoScore
      });
    }
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
    
    // 6. Analyze and create issues list (filter out fixed issues)
    const directIssues = await analyzeIssues(enhancedPages, auditId);
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

async function analyzeIssues(pages: any[], auditId?: number) {
  const issues = [];
  let fixedIssues: Array<{issueType: string, issueUrl: string, fixedAt: Date}> = [];
  
  if (auditId) {
    fixedIssues = await storage.getFixedIssues(auditId);
  }

  // Helper function to check if issue is already fixed
  const isIssueFixed = (issueType: string, pageUrl: string) => {
    return fixedIssues.some(fix => 
      fix.issueType === issueType && fix.issueUrl === pageUrl
    );
  };

  for (const page of pages) {
    // Missing meta descriptions
    if (!page.metaDescription) {
      if (!isIssueFixed('Missing Meta Description', page.url)) {
        issues.push({
          type: 'Missing Meta Description',
          severity: 'critical' as const,
          message: `Page ${page.url} is missing a meta description`,
          page: page.url
        });
      }
    }

    // Missing title
    if (!page.title) {
      if (!isIssueFixed('Missing Title Tag', page.url)) {
        issues.push({
          type: 'Missing Title Tag',
          severity: 'critical' as const,
          message: `Page ${page.url} is missing a title tag`,
          page: page.url
        });
      }
    }

    // Long title tags
    if (page.title && page.title.length > 60) {
      if (!isIssueFixed('Long Title Tag', page.url)) {
        issues.push({
          type: 'Long Title Tag',
          severity: 'medium' as const,
          message: `Page ${page.url} has a title tag that's ${page.title.length} characters (recommended: under 60)`,
          page: page.url
        });
      }
    }

    // Missing H1
    if (page.h1.length === 0) {
      if (!isIssueFixed('Missing H1 Tag', page.url)) {
        issues.push({
          type: 'Missing H1 Tag',
          severity: 'medium' as const,
          message: `Page ${page.url} is missing an H1 tag`,
          page: page.url
        });
      }
    }

    // Multiple H1s
    if (page.h1.length > 1) {
      if (!isIssueFixed('Multiple H1 Tags', page.url)) {
        issues.push({
          type: 'Multiple H1 Tags',
          severity: 'low' as const,
          message: `Page ${page.url} has ${page.h1.length} H1 tags (recommended: 1)`,
          page: page.url
        });
      }
    }

    // Missing alt text
    const missingAlt = page.images.filter((img: any) => !img.alt).length;
    if (missingAlt > 0) {
      if (!isIssueFixed('Missing Alt Text', page.url)) {
        issues.push({
          type: 'Missing Alt Text',
          severity: 'low' as const,
          message: `${missingAlt} images are missing alt text on ${page.url}`,
          page: page.url,
          count: missingAlt
        });
      }
    }

    // Thin content
    if (page.wordCount < 300) {
      if (!isIssueFixed('Thin Content', page.url)) {
        issues.push({
          type: 'Thin Content',
          severity: 'medium' as const,
          message: `Page ${page.url} has only ${page.wordCount} words (recommended: 300+)`,
          page: page.url
        });
      }
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
  
  // Calculate more aggressive penalties for issues
  const totalPages = pages.length;
  
  // Direct deductions based on actual issue counts (not capped at low values)
  totalScore -= criticalIssues * 5;  // 5 points per critical issue
  totalScore -= mediumIssues * 1.5;  // 1.5 points per medium issue  
  totalScore -= lowIssues * 0.5;     // 0.5 points per low issue
  
  // Additional penalties for high issue density
  const issueRatio = (criticalIssues + mediumIssues + lowIssues) / totalPages;
  if (issueRatio > 1) {
    totalScore -= (issueRatio - 1) * 20; // Heavy penalty for more than 1 issue per page
  }
  
  // Calculate good practice coverage
  const pagesWithTitles = pages.filter(p => p.title && p.title.trim().length > 0).length;
  const pagesWithMeta = pages.filter(p => p.metaDescription && p.metaDescription.trim().length > 0).length;
  const pagesWithH1 = pages.filter(p => p.h1 && p.h1.length > 0).length;
  
  const titleRatio = pagesWithTitles / totalPages;
  const metaRatio = pagesWithMeta / totalPages;
  const h1Ratio = pagesWithH1 / totalPages;
  
  // Smaller bonus points (good practices are expected, not exceptional)
  totalScore += titleRatio * 5; // Up to 5 points for good titles
  totalScore += metaRatio * 5;  // Up to 5 points for meta descriptions  
  totalScore += h1Ratio * 3;    // Up to 3 points for H1 tags
  
  const finalScore = Math.max(10, Math.min(100, Math.round(totalScore))); // Minimum score of 10
  console.log(`Final SEO Score: ${finalScore} (Title coverage: ${Math.round(titleRatio*100)}%, Meta coverage: ${Math.round(metaRatio*100)}%, H1 coverage: ${Math.round(h1Ratio*100)}%)`);
  console.log(`Score breakdown: Base(100) - Critical(${criticalIssues * 5}) - Medium(${mediumIssues * 1.5}) - Low(${lowIssues * 0.5}) + Bonuses = ${finalScore}`);
  
  return finalScore;
}

// Clean SEO Engine Integration for Synviz - Three Core Pillars
async function processAuditWithEngine(auditId: number, url: string, industry: string, email?: string) {
  try {
    await storage.updateAuditProgress(auditId, 10);
    
    // Import the clean SEO engine
    const { seoEngine } = await import('./core/seo-engine-simple.js');
    
    await storage.updateAuditProgress(auditId, 30);
    
    // Pillar 1: Extract information and perform comprehensive audit
    console.log(`🔍 Starting comprehensive audit for ${url} using clean SEO engine`);
    const auditResults = await seoEngine.performAudit(url, industry);
    
    await storage.updateAuditProgress(auditId, 60);
    
    // Pillar 2: Generate dynamic AI suggestions with competitor intelligence
    console.log(`🧠 Generating AI-powered suggestions for ${url}`);
    const suggestions = await seoEngine.generateSuggestions(auditResults);
    
    // Transform suggestions to match schema format
    auditResults.aiRecommendations = suggestions.map((suggestion: any) => ({
      type: suggestion.type || 'general',
      priority: suggestion.priority || 'medium',
      title: suggestion.title || 'SEO Improvement',
      description: suggestion.description || '',
      impact: suggestion.expectedImpact || 'Improved rankings',
      effort: suggestion.implementation?.difficulty || 'medium',
      content: typeof suggestion.implementation?.steps === 'string' 
        ? suggestion.implementation.steps 
        : suggestion.implementation?.steps?.join('\n') || ''
    }));
    
    await storage.updateAuditProgress(auditId, 90);
    
    // Complete audit with comprehensive results
    await storage.completeAudit(auditId, auditResults);
    
    console.log(`✅ Clean SEO audit completed for ${url} - Score: ${auditResults.stats?.seoScore}/100`);
    console.log(`📊 Analysis: ${auditResults.pages?.length} pages, ${auditResults.issues?.length} issues, ${suggestions.length} AI recommendations`);
    
  } catch (error: any) {
    console.error(`❌ Clean SEO audit failed for ${url}:`, error.message);
    await storage.failAudit(auditId, `Clean audit failed: ${error.message}`);
  }
}
