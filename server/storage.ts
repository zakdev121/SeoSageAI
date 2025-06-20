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
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Audit operations
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAudit(id: number): Promise<Audit | undefined>;
  getUserAudits(userId: number): Promise<Audit[]>;
  updateAuditProgress(id: number, progress: number): Promise<void>;
  completeAudit(id: number, results: AuditResultsType): Promise<void>;
  failAudit(id: number, error: string): Promise<void>;
  refreshAudit(id: number): Promise<void>;
  
  // SEO Issues operations
  saveSeoIssues(auditId: number, issues: SEOIssueType[]): Promise<void>;
  getSeoIssues(auditId: number): Promise<SEOIssue[]>;
  markIssueAsFixed(issueId: number): Promise<void>;
  markIssueAsIgnored(issueId: number): Promise<void>;
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

export class MemStorage implements IStorage {
  private audits: Map<number, Audit>;
  private currentId: number;
  private fixedIssues: Map<number, Array<{issueType: string, issueUrl: string, fixedAt: Date}>>;

  constructor() {
    this.audits = new Map();
    this.currentId = 1;
    this.fixedIssues = new Map();
  }

  async createAudit(insertAudit: InsertAudit): Promise<Audit> {
    const id = this.currentId++;
    const audit: Audit = {
      ...insertAudit,
      id,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      completedAt: null,
      results: null
    };
    this.audits.set(id, audit);
    return audit;
  }

  async getAudit(id: number): Promise<Audit | undefined> {
    return this.audits.get(id);
  }

  async updateAuditProgress(id: number, progress: number): Promise<void> {
    const audit = this.audits.get(id);
    if (audit) {
      audit.progress = progress;
      audit.status = progress === 100 ? 'completed' : 'processing';
      this.audits.set(id, audit);
    }
  }

  async completeAudit(id: number, results: AuditResultsType): Promise<void> {
    const audit = this.audits.get(id);
    if (audit) {
      audit.status = 'completed';
      audit.progress = 100;
      audit.completedAt = new Date();
      audit.results = results;
      this.audits.set(id, audit);
    }
  }

  async failAudit(id: number, error: string): Promise<void> {
    const audit = this.audits.get(id);
    if (audit) {
      audit.status = 'failed';
      audit.completedAt = new Date();
      this.audits.set(id, audit);
    }
  }

  async markIssueAsFixed(auditId: number, issueType: string, issueUrl: string): Promise<void> {
    if (!this.fixedIssues.has(auditId)) {
      this.fixedIssues.set(auditId, []);
    }
    
    const existingFixes = this.fixedIssues.get(auditId)!;
    const alreadyFixed = existingFixes.some(fix => 
      fix.issueType === issueType && fix.issueUrl === issueUrl
    );
    
    if (!alreadyFixed) {
      existingFixes.push({
        issueType,
        issueUrl,
        fixedAt: new Date()
      });
    }
  }

  async getFixedIssues(auditId: number): Promise<Array<{issueType: string, issueUrl: string, fixedAt: Date}>> {
    return this.fixedIssues.get(auditId) || [];
  }

  async revertFixedIssue(auditId: number, issueType: string, issueUrl: string): Promise<void> {
    const existingFixes = this.fixedIssues.get(auditId);
    if (existingFixes) {
      const filteredFixes = existingFixes.filter(fix => 
        !(fix.issueType === issueType && fix.issueUrl === issueUrl)
      );
      this.fixedIssues.set(auditId, filteredFixes);
    }
  }
}

export { storage } from "./database-storage";
