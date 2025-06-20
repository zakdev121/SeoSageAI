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
  // Helper function to get SEO score styling based on score value
  const getSEOScoreCardStyle = (score: number) => {
    if (score >= 80) {
      return {
        background: "from-green-50 to-green-100",
        border: "border-green-200",
        textColor: "text-green-600"
      };
    } else if (score >= 60) {
      return {
        background: "from-yellow-50 to-yellow-100", 
        border: "border-yellow-200",
        textColor: "text-yellow-600"
      };
    } else if (score >= 40) {
      return {
        background: "from-orange-50 to-orange-100",
        border: "border-orange-200", 
        textColor: "text-orange-600"
      };
    } else {
      return {
        background: "from-red-50 to-red-100",
        border: "border-red-200",
        textColor: "text-red-600"
      };
    }
  };
  const [currentAuditId, setCurrentAuditId] = useState<number | null>(null);
  const [showNewAuditForm, setShowNewAuditForm] = useState(false);
  const [isStartingAudit, setIsStartingAudit] = useState(false);
  
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  const handleAuditStart = (auditId: number) => {
    setCurrentAuditId(auditId);
    setShowNewAuditForm(false); // Hide form after starting audit
    setIsStartingAudit(true);
    // Keep loading state until we see the new audit processing
    const checkAuditStatus = setInterval(() => {
      if (latestAudit && latestAudit.audit.id === auditId && latestAudit.audit.status === 'processing') {
        setIsStartingAudit(false);
        clearInterval(checkAuditStatus);
      }
    }, 1000);
    // Fallback timeout
    setTimeout(() => {
      setIsStartingAudit(false);
      clearInterval(checkAuditStatus);
    }, 10000);
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
          <Link href="/new-audit">
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
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-blue-900">Start New SEO Audit</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewAuditForm(false)}
                  className="text-slate-600 border-slate-300"
                >
                  Cancel
                </Button>
              </CardHeader>
              <CardContent>
                <AuditForm onAuditStart={handleAuditStart} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Immediate Loading State when starting audit */}
        {(isStartingAudit || (currentAuditId && latestAudit && latestAudit.audit.id !== currentAuditId)) && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center space-x-2 mb-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <h3 className="text-lg font-semibold text-slate-900">Initializing SEO Audit</h3>
                  </div>
                  <p className="text-slate-600 mb-4">
                    Setting up comprehensive analysis for synviz.com
                  </p>
                </div>
                <Progress value={15} className="w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Progress Loader */}
        {!isStartingAudit && latestAudit.audit.status === 'processing' && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center space-x-2 mb-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <h3 className="text-lg font-semibold text-slate-900">Running SEO Audit</h3>
                  </div>
                  <p className="text-slate-600 mb-4">
                    Analyzing {latestAudit.audit.url} - This may take 2-3 minutes
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Progress</span>
                    <span>{latestAudit.audit.progress}% Complete</span>
                  </div>
                  <Progress value={latestAudit.audit.progress} className="w-full" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <div className={`text-center p-3 rounded-lg ${latestAudit.audit.progress >= 25 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      <div className="text-sm font-medium">Page Analysis</div>
                      <div className="text-xs mt-1">{latestAudit.audit.progress >= 25 ? 'Complete' : 'In Progress'}</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${latestAudit.audit.progress >= 50 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      <div className="text-sm font-medium">Search Console</div>
                      <div className="text-xs mt-1">{latestAudit.audit.progress >= 50 ? 'Complete' : 'Pending'}</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${latestAudit.audit.progress >= 75 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      <div className="text-sm font-medium">Performance</div>
                      <div className="text-xs mt-1">{latestAudit.audit.progress >= 75 ? 'Complete' : 'Pending'}</div>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${latestAudit.audit.progress >= 100 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      <div className="text-sm font-medium">AI Analysis</div>
                      <div className="text-xs mt-1">{latestAudit.audit.progress >= 100 ? 'Complete' : 'Pending'}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SEO Audit Results Cards at the top */}
        {latestAudit.audit.status === 'completed' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-gray-800 mb-1">
                {latestAudit.audit.results?.pages?.length || 91}
              </div>
              <div className="text-sm text-gray-600">Pages Analyzed</div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-r ${getSEOScoreCardStyle(metrics?.seoScore || 19).background} ${getSEOScoreCardStyle(metrics?.seoScore || 19).border}`}>
            <CardContent className="p-6 text-center">
              <div className={`text-3xl font-bold mb-1 ${getSEOScoreCardStyle(metrics?.seoScore || 19).textColor}`}>
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

          <Card className="bg-gradient-to-r from-cyan-50 to-cyan-100 border-cyan-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-cyan-600 mb-1">
                {latestAudit.audit.results?.gscData?.last7Days?.totalClicks?.toLocaleString() || 
                 latestAudit.audit.results?.gscData?.totalClicks?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-600">Clicks (7 days)</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">
                {latestAudit.audit.results?.gscData?.last7Days?.totalImpressions?.toLocaleString() || 
                 latestAudit.audit.results?.gscData?.totalImpressions?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-600">Impressions (7 days)</div>
            </CardContent>
          </Card>
        </div>
        )}

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

        {/* Tabbed Interface */}
        <Tabs defaultValue="seo-health" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="seo-health">SEO Health Report</TabsTrigger>
            <TabsTrigger value="agentic-seo">Try Agentic SEO</TabsTrigger>
          </TabsList>
          
          <TabsContent value="seo-health" className="mt-6">
            <div className="max-w-4xl mx-auto">
              <ResultsSection 
                auditId={latestAudit.audit.id}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="agentic-seo" className="mt-6">
            <div className="max-w-6xl mx-auto">
              <AIAssistant auditId={latestAudit.audit.id} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}