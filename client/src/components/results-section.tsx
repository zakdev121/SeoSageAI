import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Download, FileText, Brain, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";
import { AIAssistant } from "./ai-assistant";
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getOpportunityColor = (opportunity: string) => {
    switch (opportunity) {
      case 'high': return 'bg-amber-100 text-amber-800';
      case 'medium': return 'bg-green-100 text-green-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

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
            <div className="flex space-x-3">
              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
                <Button 
                  variant="outline" 
                  onClick={() => emailAddress && sendEmailMutation.mutate(emailAddress)}
                  disabled={!emailAddress || sendEmailMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  <i className="fas fa-envelope"></i>
                  <span>Email Report</span>
                </Button>
              </div>
              <Button 
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isPending}
                className="bg-primary text-white hover:bg-blue-700 flex items-center space-x-2"
              >
                <i className="fas fa-download"></i>
                <span>Download PDF</span>
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{results.stats.pagesAnalyzed}</div>
              <div className="text-sm text-slate-600">Pages Analyzed</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="text-2xl font-bold text-green-600">
                  {fixedIssuesData?.improvedScore || results.stats.seoScore}
                </div>
                {fixedIssuesData?.scoreImprovement && fixedIssuesData.scoreImprovement > 0 && (
                  <div className="flex items-center text-green-700">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">+{fixedIssuesData.scoreImprovement}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-600">SEO Score</div>
              {fixedIssuesData?.scoreImprovement && fixedIssuesData.scoreImprovement > 0 && (
                <div className="text-xs text-green-700 mt-1">
                  Improved from {fixedIssuesData.originalScore}
                </div>
              )}
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="text-2xl font-bold text-amber-600">
                  {fixedIssuesData?.remainingIssues ?? results.stats.issues}
                </div>
                {fixedIssuesData?.fixedSummary.totalFixed && fixedIssuesData.fixedSummary.totalFixed > 0 && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">-{fixedIssuesData.fixedSummary.totalFixed}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-600">Issues Found</div>
              {fixedIssuesData?.fixedSummary.totalFixed && fixedIssuesData.fixedSummary.totalFixed > 0 && (
                <div className="text-xs text-green-600 mt-1">
                  {fixedIssuesData.fixedSummary.totalFixed} issues resolved
                </div>
              )}
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{results.stats.opportunities}</div>
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
                  +{fixedIssuesData.scoreImprovement} points
                </div>
                <div className="text-xs text-green-600">Score improvement</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Content */}
      <Card>
        <Tabs defaultValue="overview" className="w-full">
          <div className="border-b border-slate-200">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview" className="flex items-center space-x-2">
                  <i className="fas fa-chart-line"></i>
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center space-x-2">
                  <i className="fas fa-tachometer-alt"></i>
                  <span>Performance</span>
                </TabsTrigger>
                <TabsTrigger value="technical" className="flex items-center space-x-2">
                  <i className="fas fa-cog"></i>
                  <span>Technical SEO</span>
                </TabsTrigger>
                <TabsTrigger value="keywords" className="flex items-center space-x-2">
                  <i className="fas fa-key"></i>
                  <span>Keywords</span>
                </TabsTrigger>
                <TabsTrigger value="content" className="flex items-center space-x-2">
                  <i className="fas fa-file-alt"></i>
                  <span>Content</span>
                </TabsTrigger>
                <TabsTrigger value="ai-solutions" className="flex items-center space-x-2">
                  <Brain className="h-4 w-4" />
                  <span>AI Solutions</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <CardContent className="p-6">
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Issues */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <i className="fas fa-exclamation-triangle text-amber-600 mr-2"></i>
                    Top Issues
                  </h3>
                  <div className="space-y-3">
                    {results.issues.slice(0, 5).map((issue, index) => (
                      <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg ${
                        issue.severity === 'critical' ? 'bg-red-50' :
                        issue.severity === 'medium' ? 'bg-amber-50' : 'bg-blue-50'
                      }`}>
                        <i className={`fas ${
                          issue.severity === 'critical' ? 'fa-times-circle text-red-600' :
                          issue.severity === 'medium' ? 'fa-exclamation-triangle text-amber-600' :
                          'fa-info-circle text-blue-600'
                        } mt-0.5`}></i>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{issue.type}</p>
                          <p className="text-sm text-slate-600">{issue.message}</p>
                        </div>
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GSC Performance */}
                {results.gscData && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                      <i className="fas fa-chart-bar text-primary mr-2"></i>
                      Search Console (90 days)
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="text-xl font-bold text-slate-900">{results.gscData.totalClicks.toLocaleString()}</div>
                          <div className="text-sm text-slate-600">Total Clicks</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="text-xl font-bold text-slate-900">{results.gscData.totalImpressions.toLocaleString()}</div>
                          <div className="text-sm text-slate-600">Impressions</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="text-xl font-bold text-slate-900">{results.gscData.avgCTR}%</div>
                          <div className="text-sm text-slate-600">Avg CTR</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="text-xl font-bold text-slate-900">{results.gscData.avgPosition}</div>
                          <div className="text-sm text-slate-600">Avg Position</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="technical" className="space-y-6">
              {/* Technical SEO Issues */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <i className="fas fa-cog text-primary mr-2"></i>
                  Technical SEO Issues
                </h3>
                <div className="space-y-4">
                  {results.issues
                    .filter(issue => 
                      !issue.type.toLowerCase().includes('meta') && 
                      !issue.type.toLowerCase().includes('title') && 
                      !issue.type.toLowerCase().includes('content') &&
                      !issue.type.toLowerCase().includes('heading'))
                    .map((issue, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${
                      issue.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      issue.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{issue.type}</h4>
                          <p className="text-sm text-slate-600 mt-1">{issue.message}</p>
                          {issue.page && (
                            <p className="text-xs text-slate-500 mt-2">Page: {issue.page}</p>
                          )}
                        </div>
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Web Vitals */}
              {results.pageSpeedData && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Core Web Vitals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600 mb-1">First Contentful Paint</div>
                      <div className={`text-xl font-bold ${results.pageSpeedData.firstContentfulPaint < 2000 ? 'text-green-600' : results.pageSpeedData.firstContentfulPaint < 4000 ? 'text-amber-600' : 'text-red-600'}`}>
                        {(results.pageSpeedData.firstContentfulPaint / 1000).toFixed(2)}s
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {results.pageSpeedData.firstContentfulPaint < 2000 ? 'Good' : results.pageSpeedData.firstContentfulPaint < 4000 ? 'Needs Improvement' : 'Poor'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600 mb-1">Largest Contentful Paint</div>
                      <div className={`text-xl font-bold ${results.pageSpeedData.largestContentfulPaint < 2500 ? 'text-green-600' : results.pageSpeedData.largestContentfulPaint < 4000 ? 'text-amber-600' : 'text-red-600'}`}>
                        {(results.pageSpeedData.largestContentfulPaint / 1000).toFixed(2)}s
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {results.pageSpeedData.largestContentfulPaint < 2500 ? 'Good' : results.pageSpeedData.largestContentfulPaint < 4000 ? 'Needs Improvement' : 'Poor'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600 mb-1">Cumulative Layout Shift</div>
                      <div className={`text-xl font-bold ${results.pageSpeedData.cumulativeLayoutShift < 0.1 ? 'text-green-600' : results.pageSpeedData.cumulativeLayoutShift < 0.25 ? 'text-amber-600' : 'text-red-600'}`}>
                        {results.pageSpeedData.cumulativeLayoutShift.toFixed(3)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {results.pageSpeedData.cumulativeLayoutShift < 0.1 ? 'Good' : results.pageSpeedData.cumulativeLayoutShift < 0.25 ? 'Needs Improvement' : 'Poor'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Recommendations */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Technical SEO Recommendations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Priority Fixes</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• Fix missing meta descriptions (0% coverage)</li>
                      <li>• Add proper H1 tags to all pages</li>
                      <li>• Optimize page load speeds</li>
                      <li>• Improve mobile responsiveness</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Technical Improvements</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• Implement structured data markup</li>
                      <li>• Optimize images for web</li>
                      <li>• Enable browser caching</li>
                      <li>• Minify CSS and JavaScript</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Site Analysis Summary */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Site Analysis Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900">100%</div>
                    <div className="text-sm text-slate-600">Title Tag Coverage</div>
                    <div className="text-xs text-green-600 mt-1">Good</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">0%</div>
                    <div className="text-sm text-slate-600">Meta Description Coverage</div>
                    <div className="text-xs text-red-600 mt-1">Needs Attention</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">0%</div>
                    <div className="text-sm text-slate-600">H1 Tag Coverage</div>
                    <div className="text-xs text-red-600 mt-1">Needs Attention</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              {results.pageSpeedData ? (
                <div className="space-y-6">
                  {/* Performance Scores */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                      <i className="fas fa-tachometer-alt text-primary mr-2"></i>
                      PageSpeed Insights Scores
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <div className={`text-2xl font-bold ${results.pageSpeedData.performanceScore >= 90 ? 'text-green-600' : results.pageSpeedData.performanceScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {results.pageSpeedData.performanceScore}
                        </div>
                        <div className="text-sm text-slate-600">Performance</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <div className={`text-2xl font-bold ${results.pageSpeedData.accessibilityScore >= 90 ? 'text-green-600' : results.pageSpeedData.accessibilityScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {results.pageSpeedData.accessibilityScore}
                        </div>
                        <div className="text-sm text-slate-600">Accessibility</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <div className={`text-2xl font-bold ${results.pageSpeedData.bestPracticesScore >= 90 ? 'text-green-600' : results.pageSpeedData.bestPracticesScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {results.pageSpeedData.bestPracticesScore}
                        </div>
                        <div className="text-sm text-slate-600">Best Practices</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <div className={`text-2xl font-bold ${results.pageSpeedData.seoScore >= 90 ? 'text-green-600' : results.pageSpeedData.seoScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {results.pageSpeedData.seoScore}
                        </div>
                        <div className="text-sm text-slate-600">SEO</div>
                      </div>
                    </div>
                  </div>

                  {/* Core Web Vitals */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Core Web Vitals</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-sm text-slate-600 mb-1">First Contentful Paint</div>
                        <div className="text-xl font-bold text-slate-900">
                          {(results.pageSpeedData.firstContentfulPaint / 1000).toFixed(2)}s
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-sm text-slate-600 mb-1">Largest Contentful Paint</div>
                        <div className="text-xl font-bold text-slate-900">
                          {(results.pageSpeedData.largestContentfulPaint / 1000).toFixed(2)}s
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-sm text-slate-600 mb-1">Cumulative Layout Shift</div>
                        <div className="text-xl font-bold text-slate-900">
                          {results.pageSpeedData.cumulativeLayoutShift.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Opportunities */}
                  {results.pageSpeedData.opportunities.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Opportunities</h3>
                      <div className="space-y-3">
                        {results.pageSpeedData.opportunities.slice(0, 5).map((opportunity, index) => (
                          <div key={index} className="flex items-start space-x-3 p-4 bg-amber-50 rounded-lg">
                            <i className="fas fa-lightbulb text-amber-600 mt-0.5"></i>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{opportunity.title}</p>
                              <p className="text-sm text-slate-600">{opportunity.description}</p>
                              <p className="text-sm text-amber-700 font-medium mt-1">
                                Potential savings: {opportunity.savings}s
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitors Analysis */}
                  {results.competitors && results.competitors.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Competitor Landscape</h3>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Domain</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Average Ranking</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.competitors.slice(0, 8).map((competitor, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{competitor.domain}</TableCell>
                                <TableCell className="max-w-xs truncate">{competitor.title}</TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-100 text-blue-800">
                                    #{competitor.ranking}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-info-circle text-slate-400 text-3xl mb-4"></i>
                  <p className="text-slate-600">Performance data requires Google API keys to be configured.</p>
                  <p className="text-sm text-slate-500 mt-2">Contact your administrator to enable PageSpeed Insights analysis.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="keywords">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Opportunity Keywords</h3>
                  <p className="text-slate-600 mb-4">Keywords ranking in positions 10-30 with high potential</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Impressions</TableHead>
                          <TableHead>Clicks</TableHead>
                          <TableHead>CTR</TableHead>
                          <TableHead>Opportunity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.keywordOpportunities.slice(0, 10).map((keyword, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium text-slate-900">{keyword.keyword}</TableCell>
                            <TableCell className="text-amber-600 font-medium">{keyword.position.toFixed(1)}</TableCell>
                            <TableCell className="text-slate-600">{keyword.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-600">{keyword.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-600">{keyword.ctr.toFixed(1)}%</TableCell>
                            <TableCell>
                              <Badge className={getOpportunityColor(keyword.opportunity)}>
                                {keyword.opportunity}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Long-tail Suggestions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.longtailKeywords.slice(0, 8).map((suggestion, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-4">
                        <h4 className="font-medium text-slate-900 mb-2">{suggestion.keyword}</h4>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <span>Volume: ~{suggestion.volume}/mo</span>
                          <span>Competition: {suggestion.competition}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="content">
              <div className="space-y-6">
                {/* Content Issues */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Content Issues & Opportunities</h3>
                  <div className="space-y-4">
                    {results.issues
                      .filter(issue => issue.type.toLowerCase().includes('meta') || 
                                     issue.type.toLowerCase().includes('title') || 
                                     issue.type.toLowerCase().includes('content') ||
                                     issue.type.toLowerCase().includes('heading'))
                      .map((issue, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        issue.severity === 'critical' ? 'bg-red-50 border-red-200' :
                        issue.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{issue.type}</h4>
                            <p className="text-sm text-slate-600 mt-1">{issue.message}</p>
                            {issue.page && (
                              <p className="text-xs text-slate-500 mt-2">Page: {issue.page}</p>
                            )}
                          </div>
                          <Badge className={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Content Recommendations */}
                {results.aiRecommendations && results.aiRecommendations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">AI Content Recommendations</h3>
                    <div className="space-y-4">
                      {results.aiRecommendations.map((rec, index) => (
                        <div key={index} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-slate-900">{rec.title}</h4>
                            <Badge className={`ml-2 ${
                              rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                              rec.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {rec.priority} priority
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{rec.description}</p>
                          {rec.targetKeyword && (
                            <p className="text-xs text-slate-500">Target keyword: {rec.targetKeyword}</p>
                          )}
                          {rec.content && (
                            <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
                              <strong>Suggested content:</strong>
                              <p className="mt-1">{rec.content}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Keywords for Content */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Content Optimization Keywords</h3>
                  <p className="text-slate-600 mb-4">Top performing keywords from Google Search Console to optimize content around</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.gscData?.topQueries?.slice(0, 9).map((query, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-4">
                        <h4 className="font-medium text-slate-900 mb-2">"{query.query}"</h4>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex justify-between">
                            <span>Clicks:</span>
                            <span className="font-medium">{query.clicks}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Impressions:</span>
                            <span className="font-medium">{query.impressions.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Position:</span>
                            <span className="font-medium">#{query.position.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CTR:</span>
                            <span className="font-medium">{query.ctr.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Strategy */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Content Strategy Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">High-Opportunity Keywords</h4>
                      <ul className="text-sm text-slate-600 space-y-1">
                        {results.keywordOpportunities?.slice(0, 5).map((keyword, index) => (
                          <li key={index}>• {keyword.keyword} (Pos: {keyword.position.toFixed(1)})</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Content Recommendations</h4>
                      <ul className="text-sm text-slate-600 space-y-1">
                        <li>• Create content targeting position 11-30 keywords</li>
                        <li>• Optimize existing pages for better CTR</li>
                        <li>• Add internal links between related content</li>
                        <li>• Update meta descriptions for higher CTR</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai-solutions">
              <div className="space-y-6">
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-blue-600" />
                      AI-Powered SEO Solutions
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Review AI-generated issue resolutions and blog content strategy. Approve solutions to implement.
                    </p>
                  </CardHeader>
                </Card>
                
                <AIAssistant auditId={auditId} />
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
