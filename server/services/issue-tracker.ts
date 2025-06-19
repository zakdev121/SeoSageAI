import { storage } from '../storage';

export interface FixedIssue {
  issueType: string;
  pageUrl: string;
  fixedAt: Date;
  fixDetails?: any;
}

export class IssueTrackerService {
  async markIssueAsFixed(
    auditId: number, 
    issueType: string, 
    pageUrl: string, 
    fixDetails?: any
  ): Promise<void> {
    await storage.markIssueAsFixed(auditId, issueType, pageUrl);
    console.log(`✓ Issue tracked as fixed: ${issueType} on ${pageUrl}`);
  }

  async isIssueFixed(
    auditId: number, 
    issueType: string, 
    pageUrl: string
  ): Promise<boolean> {
    const fixedIssues = await storage.getFixedIssues(auditId);
    return fixedIssues.some(fix => 
      fix.issueType === issueType && 
      (fix.issueUrl === pageUrl || this.urlsMatch(fix.issueUrl, pageUrl))
    );
  }

  private urlsMatch(url1: string, url2: string): boolean {
    // Normalize URLs for comparison
    const normalize = (url: string): string => {
      return url.replace(/\/$/, '').toLowerCase();
    };
    
    return normalize(url1) === normalize(url2);
  }

  async getFixedIssuesSummary(auditId: number): Promise<{
    totalFixed: number;
    byType: Record<string, number>;
    recentFixes: FixedIssue[];
  }> {
    const fixedIssues = await storage.getFixedIssues(auditId);
    
    const byType: Record<string, number> = {};
    fixedIssues.forEach(fix => {
      byType[fix.issueType] = (byType[fix.issueType] || 0) + 1;
    });
    
    const recentFixes = fixedIssues
      .sort((a, b) => b.fixedAt.getTime() - a.fixedAt.getTime())
      .slice(0, 10);
    
    return {
      totalFixed: fixedIssues.length,
      byType,
      recentFixes: recentFixes.map(fix => ({
        issueType: fix.issueType,
        pageUrl: fix.issueUrl,
        fixedAt: fix.fixedAt
      }))
    };
  }
}

export const issueTracker = new IssueTrackerService();