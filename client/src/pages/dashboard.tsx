import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, Globe, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { ResultsSection } from "@/components/results-section";

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
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

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
                <p className="text-xs text-slate-500">Real-time audit insights for {latestAudit.audit.url}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Home</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards at the top */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SEO Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.seoScore || 0}/100
              </div>
              <Progress value={metrics?.seoScore || 0} className="mt-2" />
            </CardContent>
          </Card>

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

        {/* Full Results Section - Same as main page */}
        <div className="max-w-4xl mx-auto">
          <ResultsSection 
            auditId={latestAudit.audit.id}
          />
        </div>
      </main>
    </div>
  );
}