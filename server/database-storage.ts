import { 
  audits, 
  seoIssues, 
  blogPosts, 
  dashboardMetrics,
  type Audit, 
  type InsertAudit, 
  type AuditResultsType,
  type SEOIssue,
  type InsertSEOIssue,
  type SEOIssueType,
  type BlogPost,
  type InsertBlogPost,
  type DashboardMetrics,
  type InsertDashboardMetrics
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Audit operations
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAudit(id: number): Promise<Audit | undefined>;
  getUserAudits(userId: number): Promise<Audit[]>;
  updateAuditProgress(id: number, progress: number): Promise<void>;
  completeAudit(id: number, results: AuditResultsType): Promise<void>;
  failAudit(id: number, error: string): Promise<void>;
  refreshAudit(id: number): Promise<void>;
  
  // Legacy fixed issues methods (for backward compatibility)
  markIssueAsFixed(auditId: number, issueType: string, issueUrl: string): Promise<void>;
  getFixedIssues(auditId: number): Promise<Array<{issueType: string, issueUrl: string, fixedAt: Date}>>;
  revertFixedIssue(auditId: number, issueType: string, issueUrl: string): Promise<void>;
  
  // SEO Issues operations
  saveSeoIssues(auditId: number, issues: SEOIssueType[]): Promise<void>;
  getSeoIssues(auditId: number): Promise<SEOIssue[]>;
  markSeoIssueAsFixed(issueId: number): Promise<void>;
  markSeoIssueAsIgnored(issueId: number): Promise<void>;
  getActiveIssues(auditId: number): Promise<SEOIssue[]>;
  
  // Blog Posts operations
  saveBlogPost(blogPost: InsertBlogPost): Promise<BlogPost>;
  getBlogPosts(auditId: number): Promise<BlogPost[]>;
  publishBlogPost(blogId: number): Promise<void>;
  updateBlogPost(blogId: number, content: string, wordCount: number): Promise<void>;
  
  // Dashboard Metrics operations
  updateDashboardMetrics(auditId: number, metrics: Partial<InsertDashboardMetrics>): Promise<void>;
  getDashboardMetrics(auditId: number): Promise<DashboardMetrics | undefined>;
  calculateMetrics(auditId: number): Promise<DashboardMetrics>;
}

export class DatabaseStorage implements IStorage {
  
  // Audit operations
  async createAudit(insertAudit: InsertAudit): Promise<Audit> {
    const [audit] = await db
      .insert(audits)
      .values({
        ...insertAudit,
        tenantId: 'synviz', // Default tenant for now
        lastUpdated: new Date()
      })
      .returning();
    return audit;
  }

  async getAudit(id: number): Promise<Audit | undefined> {
    const [audit] = await db.select().from(audits).where(eq(audits.id, id));
    return audit;
  }

  async getUserAudits(userId: number): Promise<Audit[]> {
    return await db
      .select()
      .from(audits)
      .where(eq(audits.userId, userId))
      .orderBy(desc(audits.createdAt));
  }

  async updateAuditProgress(id: number, progress: number): Promise<void> {
    await db
      .update(audits)
      .set({ 
        progress, 
        lastUpdated: new Date(),
        status: progress >= 100 ? 'completed' : 'processing'
      })
      .where(eq(audits.id, id));
  }

  async completeAudit(id: number, results: AuditResultsType): Promise<void> {
    // Complete the audit
    await db
      .update(audits)
      .set({
        status: 'completed',
        progress: 100,
        results,
        completedAt: new Date(),
        lastUpdated: new Date()
      })
      .where(eq(audits.id, id));

    // Save SEO issues to separate table
    await this.saveSeoIssues(id, results.issues || []);

    // Calculate and save dashboard metrics
    await this.calculateAndSaveMetrics(id, results);
  }

  async failAudit(id: number, error: string): Promise<void> {
    await db
      .update(audits)
      .set({
        status: 'failed',
        results: { error },
        lastUpdated: new Date()
      })
      .where(eq(audits.id, id));
  }

  async refreshAudit(id: number): Promise<void> {
    await db
      .update(audits)
      .set({
        status: 'processing',
        progress: 0,
        lastUpdated: new Date()
      })
      .where(eq(audits.id, id));
  }

  // SEO Issues operations
  async saveSeoIssues(auditId: number, issues: SEOIssueType[]): Promise<void> {
    if (issues.length === 0) return;

    const issueRecords = issues.map(issue => ({
      auditId,
      issueType: issue.type,
      pageUrl: issue.page || '',
      description: issue.message || issue.type,
      severity: issue.severity === 'critical' ? 'high' : issue.severity.toLowerCase() as 'high' | 'medium' | 'low',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await db.insert(seoIssues).values(issueRecords);
  }

  async getSeoIssues(auditId: number): Promise<SEOIssue[]> {
    return await db
      .select()
      .from(seoIssues)
      .where(eq(seoIssues.auditId, auditId))
      .orderBy(desc(seoIssues.createdAt));
  }

  // Legacy methods for backward compatibility
  async markIssueAsFixed(auditId: number, issueType: string, issueUrl: string): Promise<void> {
    await db
      .update(seoIssues)
      .set({
        status: 'fixed',
        fixedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(seoIssues.auditId, auditId),
        eq(seoIssues.issueType, issueType),
        eq(seoIssues.pageUrl, issueUrl)
      ));
  }

  async getFixedIssues(auditId: number): Promise<Array<{issueType: string, issueUrl: string, fixedAt: Date}>> {
    const fixedIssues = await db
      .select()
      .from(seoIssues)
      .where(and(
        eq(seoIssues.auditId, auditId),
        eq(seoIssues.status, 'fixed')
      ));

    return fixedIssues.map(issue => ({
      issueType: issue.issueType,
      issueUrl: issue.pageUrl,
      fixedAt: issue.fixedAt || new Date()
    }));
  }

  async revertFixedIssue(auditId: number, issueType: string, issueUrl: string): Promise<void> {
    await db
      .update(seoIssues)
      .set({
        status: 'active',
        fixedAt: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(seoIssues.auditId, auditId),
        eq(seoIssues.issueType, issueType),
        eq(seoIssues.pageUrl, issueUrl)
      ));
  }

  async markSeoIssueAsFixed(issueId: number): Promise<void> {
    await db
      .update(seoIssues)
      .set({
        status: 'fixed',
        fixedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(seoIssues.id, issueId));
  }

  async markSeoIssueAsIgnored(issueId: number): Promise<void> {
    await db
      .update(seoIssues)
      .set({
        status: 'ignored',
        updatedAt: new Date()
      })
      .where(eq(seoIssues.id, issueId));
  }

  async getActiveIssues(auditId: number): Promise<SEOIssue[]> {
    return await db
      .select()
      .from(seoIssues)
      .where(and(
        eq(seoIssues.auditId, auditId),
        eq(seoIssues.status, 'active')
      ));
  }

  // Blog Posts operations
  async saveBlogPost(blogPost: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db
      .insert(blogPosts)
      .values({
        ...blogPost,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return post;
  }

  async getBlogPosts(auditId: number): Promise<BlogPost[]> {
    return await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.auditId, auditId))
      .orderBy(desc(blogPosts.createdAt));
  }

  async publishBlogPost(blogId: number): Promise<void> {
    await db
      .update(blogPosts)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(blogPosts.id, blogId));
  }

  async updateBlogPost(blogId: number, content: string, wordCount: number): Promise<void> {
    await db
      .update(blogPosts)
      .set({
        content,
        wordCount,
        updatedAt: new Date()
      })
      .where(eq(blogPosts.id, blogId));
  }

  // Dashboard Metrics operations
  async updateDashboardMetrics(auditId: number, metrics: Partial<InsertDashboardMetrics>): Promise<void> {
    const existingMetrics = await db
      .select()
      .from(dashboardMetrics)
      .where(eq(dashboardMetrics.auditId, auditId));

    if (existingMetrics.length > 0) {
      await db
        .update(dashboardMetrics)
        .set({
          ...metrics,
          lastCalculated: new Date()
        })
        .where(eq(dashboardMetrics.auditId, auditId));
    } else {
      await db
        .insert(dashboardMetrics)
        .values({
          auditId,
          ...metrics,
          lastCalculated: new Date()
        });
    }
  }

  async getDashboardMetrics(auditId: number): Promise<DashboardMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(dashboardMetrics)
      .where(eq(dashboardMetrics.auditId, auditId));
    return metrics;
  }

  async calculateMetrics(auditId: number): Promise<DashboardMetrics> {
    const audit = await this.getAudit(auditId);
    const issues = await this.getSeoIssues(auditId);
    const blogs = await this.getBlogPosts(auditId);

    const totalIssues = issues.length;
    const fixedIssues = issues.filter(i => i.status === 'fixed').length;
    const activeIssues = issues.filter(i => i.status === 'active').length;
    const publishedBlogs = blogs.filter(b => b.status === 'published').length;
    const draftBlogs = blogs.filter(b => b.status === 'draft').length;

    // Extract SEO score from audit results with proper type checking
    const auditResults = audit?.results as any;
    const seoScore = auditResults?.stats?.seoScore || 0;

    const metrics = {
      auditId,
      seoScore,
      totalIssues,
      fixedIssues,
      activeIssues,
      publishedBlogs,
      draftBlogs,
      lastCalculated: new Date()
    };

    await this.updateDashboardMetrics(auditId, metrics);
    return metrics as DashboardMetrics;
  }

  private async calculateAndSaveMetrics(auditId: number, results: AuditResultsType): Promise<void> {
    const totalIssues = results.issues?.length || 0;
    const seoScore = results.stats?.seoScore || 0;

    await this.updateDashboardMetrics(auditId, {
      seoScore,
      totalIssues,
      fixedIssues: 0,
      activeIssues: totalIssues,
      publishedBlogs: 0,
      draftBlogs: 0
    });
  }
}

export const storage = new DatabaseStorage();