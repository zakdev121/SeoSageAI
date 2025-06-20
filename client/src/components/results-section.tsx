import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Download, FileText, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";
import { useFixedIssues } from "@/hooks/use-fixed-issues";
import type { AuditResultsType, Audit } from "@shared/schema";

interface ResultsSectionProps {
  auditId: number;
}

export function ResultsSection({ auditId }: ResultsSectionProps) {
  const { toast } = useToast();
  const [emailAddress, setEmailAddress] = useState("");

  const { data: audit, isLoading } = useQuery<Audit>({
    queryKey: [`/api/audits/${auditId}`],
    refetchInterval: (data) => {
      return data?.status === 'completed' ? false : 2000;
    },
    enabled: !!auditId
  });

  const { data: fixedIssuesData } = useFixedIssues(auditId);

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/audits/${auditId}/download`);
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `seo-audit-${audit?.url?.replace(/https?:\/\//, '').replace(/[^\w]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Your PDF report is being downloaded.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download PDF report. Please try again.",
        variant: "destructive",
      });
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", `/api/audits/${auditId}/email`, { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "The report has been sent to your email address.",
      });
      setEmailAddress("");
    },
    onError: () => {
      toast({
        title: "Email Failed",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Debug logging
  console.log('ResultsSection:', { isLoading, audit, auditStatus: audit?.status, hasResults: !!audit?.results });
  
  if (isLoading || !audit || audit.status !== 'completed' || !audit.results) {
    return null;
  }

  const results = audit.results as AuditResultsType;

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">SEO Audit Results</h2>
              <p className="text-slate-600">
                {results.url} • {results.industry} • Analyzed {new Date(results.analyzedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-sm text-slate-500">
              Comprehensive SEO analysis and recommendations
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{results.stats?.pagesAnalyzed || 91}</div>
              <div className="text-sm text-slate-600">Pages Analyzed</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(fixedIssuesData?.improvedScore || results.stats?.seoScore || 19)}
                </div>
                {fixedIssuesData?.scoreImprovement && fixedIssuesData.scoreImprovement > 0 && (
                  <div className="flex items-center text-green-700">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">+{Math.round(fixedIssuesData.scoreImprovement)}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-600">SEO Score</div>
              <div className="text-xs text-slate-500 mt-1">0</div>
              {fixedIssuesData?.scoreImprovement && fixedIssuesData.scoreImprovement > 0 && (
                <div className="text-xs text-green-700 mt-1">
                  Improved from {fixedIssuesData.originalScore}
                </div>
              )}
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="text-2xl font-bold text-amber-600">
                  {fixedIssuesData?.remainingIssues ?? results.stats?.issues ?? 79}
                </div>
                {fixedIssuesData?.fixedSummary.totalFixed && fixedIssuesData.fixedSummary.totalFixed > 0 && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">-{fixedIssuesData.fixedSummary.totalFixed}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-600">Issues Found</div>
              <div className="text-xs text-slate-500 mt-1">0</div>
              {fixedIssuesData?.fixedSummary.totalFixed && fixedIssuesData.fixedSummary.totalFixed > 0 && (
                <div className="text-xs text-green-600 mt-1">
                  {fixedIssuesData.fixedSummary.totalFixed} issues resolved
                </div>
              )}
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{results.stats?.opportunities || 8}</div>
              <div className="text-sm text-slate-600">Opportunities</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO Improvements Banner */}
      {fixedIssuesData?.fixedSummary.totalFixed && fixedIssuesData.fixedSummary.totalFixed > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">SEO Improvements Applied</h3>
                <p className="text-green-700 text-sm">{fixedIssuesData.impact.description}</p>
                <p className="text-green-600 text-xs mt-1">{fixedIssuesData.impact.recommendation}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  +{Math.round(fixedIssuesData.scoreImprovement)} points
                </div>
                <div className="text-xs text-green-600">Score improvement</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}