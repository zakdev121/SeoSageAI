import { audits, type Audit, type InsertAudit, type AuditResultsType } from "@shared/schema";

export interface IStorage {
  createAudit(audit: InsertAudit): Promise<Audit>;
  getAudit(id: number): Promise<Audit | undefined>;
  updateAuditProgress(id: number, progress: number): Promise<void>;
  completeAudit(id: number, results: AuditResultsType): Promise<void>;
  failAudit(id: number, error: string): Promise<void>;
  markIssueAsFixed(auditId: number, issueType: string, issueUrl: string): Promise<void>;
  getFixedIssues(auditId: number): Promise<Array<{issueType: string, issueUrl: string, fixedAt: Date}>>;
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
}

export const storage = new MemStorage();
