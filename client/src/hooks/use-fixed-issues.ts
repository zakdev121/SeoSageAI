import { useQuery } from "@tanstack/react-query";

export interface FixedIssuesData {
  originalScore: number;
  improvedScore: number;
  scoreImprovement: number;
  originalIssues: number;
  remainingIssues: number;
  fixedSummary: {
    totalFixed: number;
    byType: Record<string, number>;
    recentFixes: Array<{
      issueType: string;
      pageUrl: string;
      fixedAt: Date;
    }>;
  };
  impact: {
    description: string;
    recommendation: string;
  };
}

export function useFixedIssues(auditId: number) {
  return useQuery<FixedIssuesData>({
    queryKey: [`/api/audits/${auditId}/fixed-issues`],
    refetchInterval: 5000, // Check for updates every 5 seconds
    enabled: !!auditId,
  });
}