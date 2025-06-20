import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, Globe } from "lucide-react";

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
          <Button onClick={() => window.location.href = '/'}>
            Start New Audit
          </Button>
        </div>
      </div>
    );
  }

  const latestAudit = dashboardData[0];
  const metrics = latestAudit.metrics;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SEO AI Dashboard</h1>
          <p className="text-gray-600">Real-time insights for {latestAudit.audit.url}</p>
        </div>
        <Button onClick={() => window.location.href = '/'}>
          New Audit
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.seoScore || 0}/100
            </div>
            <Progress value={metrics?.seoScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {latestAudit.activeIssues}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {latestAudit.fixedIssues} fixed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.publishedBlogs || 0}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {metrics?.draftBlogs || 0} in draft
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Audit Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {latestAudit.audit.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : latestAudit.audit.status === 'processing' ? (
                <Clock className="h-5 w-5 text-blue-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm font-medium capitalize">
                {latestAudit.audit.status}
              </span>
            </div>
            {latestAudit.audit.status === 'processing' && (
              <Progress value={latestAudit.audit.progress} className="mt-2" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Recent SEO Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestAudit.recentIssues.length > 0 ? (
              <div className="space-y-3">
                {latestAudit.recentIssues.map((issue) => (
                  <div key={issue.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{issue.issueType}</div>
                      <div className="text-xs text-gray-600 truncate">{issue.pageUrl}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        issue.severity === 'high' ? 'destructive' :
                        issue.severity === 'medium' ? 'default' : 'secondary'
                      }>
                        {issue.severity}
                      </Badge>
                      <Badge variant={issue.status === 'fixed' ? 'secondary' : 'outline'}>
                        {issue.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No issues found</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Blog Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Blog Posts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestAudit.recentBlogs.length > 0 ? (
              <div className="space-y-3">
                {latestAudit.recentBlogs.map((blog) => (
                  <div key={blog.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{blog.title}</div>
                      <div className="text-xs text-gray-600">
                        {blog.wordCount} words • {new Date(blog.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={blog.status === 'published' ? 'secondary' : 'outline'}>
                      {blog.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No blog posts yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData.map((data) => (
              <div key={data.audit.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="font-medium">{data.audit.url}</div>
                    <div className="text-sm text-gray-600">{data.audit.industry}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Score: {data.metrics?.seoScore || 0}/100
                    </div>
                    <div className="text-xs text-gray-600">
                      {data.activeIssues} active issues
                    </div>
                  </div>
                  <Badge variant={
                    data.audit.status === 'completed' ? 'secondary' :
                    data.audit.status === 'processing' ? 'default' : 'outline'
                  }>
                    {data.audit.status}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = `/audit/${data.audit.id}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}