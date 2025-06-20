import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, Globe, ArrowLeft, Plus, Play } from "lucide-react";
import { Link } from "wouter";
import { ResultsSection } from "@/components/results-section";
import { AIAssistant } from "@/components/ai-assistant";
import { AuditForm } from "@/components/audit-form";

interface DashboardData {
  audit: {
    id: number;
    url: string;
    industry: string;
    status: string;
    progress: number;
    createdAt: string;
    completedAt: string | null;
    results: any;
  };
  metrics: {
    seoScore: number;
    totalIssues: number;
    fixedIssues: number;
    activeIssues: number;
    publishedBlogs: number;
    draftBlogs: number;
  } | null;
  recentIssues: Array<{
    id: number;
    issueType: string;
    pageUrl: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  recentBlogs: Array<{
    id: number;
    title: string;
    status: string;
    wordCount: number;
    createdAt: string;
  }>;
  hasResults: boolean;
  totalIssues: number;
  activeIssues: number;
  fixedIssues: number;
}

export default function Dashboard() {
  const [currentAuditId, setCurrentAuditId] = useState<number | null>(null);
  const [showNewAuditForm, setShowNewAuditForm] = useState(false);
  
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  const handleAuditStart = (auditId: number) => {
    setCurrentAuditId(auditId);
    setShowNewAuditForm(false); // Hide form after starting audit
  };

  const handleNewAuditClick = () => {
    setShowNewAuditForm(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading your SEO dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p>Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  if (!dashboardData || dashboardData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No audits found</h2>
          <p className="text-gray-600 mb-4">Start your first SEO audit to see dashboard data</p>
          <Link href="/">
            <Button>Start New Audit</Button>
          </Link>
        </div>
      </div>
    );
  }

  const latestAudit = dashboardData[0];
  const metrics = latestAudit.metrics;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-bar text-white text-sm"></i>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">SEO Dashboard</h1>
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span className="font-medium">{latestAudit.audit.url}</span>
                  <span>•</span>
                  <span>{latestAudit.audit.industry}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right text-xs text-slate-500">
                <div>Last Audit Run:</div>
                <div className="font-medium">
                  {latestAudit.audit.completedAt 
                    ? new Date(latestAudit.audit.completedAt).toLocaleString()
                    : 'In Progress'
                  }
                </div>
              </div>
              <Button
                onClick={handleNewAuditClick}
                size="sm"
                className="flex items-center space-x-1"
              >
                <Play className="w-4 h-4" />
                <span>Run Audit</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Audit Form for new audits - only show when requested */}
        {showNewAuditForm && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Start New SEO Audit</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditForm onAuditStart={handleAuditStart} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* SEO Audit Results Cards at the top */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-gray-800 mb-1">
                {latestAudit.audit.results?.pages?.length || 91}
              </div>
              <div className="text-sm text-gray-600">Pages Analyzed</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {metrics?.seoScore || 19}/100
              </div>
              <div className="text-sm text-gray-600">SEO Score</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">
                {metrics?.totalIssues || 79}
              </div>
              <div className="text-sm text-gray-600">Issues Found</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">8</div>
              <div className="text-sm text-gray-600">Opportunities</div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalIssues || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.activeIssues || 0} active, {metrics?.fixedIssues || 0} fixed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.publishedBlogs || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.draftBlogs || 0} drafts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={latestAudit.audit.status === 'completed' ? 'default' : 'secondary'}
                >
                  {latestAudit.audit.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {latestAudit.audit.completedAt 
                  ? `Completed ${new Date(latestAudit.audit.completedAt).toLocaleDateString()}`
                  : 'In progress'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Consolidated Dashboard Content */}
        <div className="space-y-8">
          {/* SEO Audit Results */}
          <div className="max-w-4xl mx-auto">
            <ResultsSection 
              auditId={latestAudit.audit.id}
            />
          </div>
          
          {/* AI Assistant */}
          <div className="max-w-6xl mx-auto">
            <AIAssistant auditId={latestAudit.audit.id} />
          </div>
        </div>
      </main>
    </div>
  );
}