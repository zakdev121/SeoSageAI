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
import { useFixedIssues } from "@/hooks/use-fixed-issues";
import type { AuditResultsType, Audit } from "@shared/schema";

interface ResultsSectionProps {
  auditId: number;
}

export function ResultsSection({ auditId }: ResultsSectionProps) {
  const { toast } = useToast();
  const [emailAddress, setEmailAddress] = useState("");
  const [fixingPages, setFixingPages] = useState<Set<string>>(new Set());

  const { data: audit, isLoading } = useQuery<Audit>({
    queryKey: [`/api/audits/${auditId}`],
    refetchInterval: (data) => {
      return data?.status === 'completed' ? false : 2000;
    },
    enabled: !!auditId,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache audit data
  });

  const { data: fixedIssuesData } = useFixedIssues(auditId);

  // Mutation for fixing page SEO issues
  const fixPageMutation = useMutation({
    mutationFn: async ({ pageUrl, page }: { pageUrl: string; page: any }) => {
      return await apiRequest(`/api/audits/${auditId}/fix-page`, {
        method: 'POST',
        body: {
          pageUrl,
          title: page.title,
          currentMetaDescription: page.metaDescription,
          wordCount: page.wordCount,
          content: page.content || '',
          industry: audit?.industry
        }
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Page Fixed Successfully",
        description: `Generated SEO-optimized meta description for ${variables.pageUrl.replace(/^https?:\/\/[^\/]+/, '')}`
      });
      setFixingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.pageUrl);
        return newSet;
      });
    },
    onError: (error, variables) => {
      toast({
        title: "Fix Failed",
        description: `Failed to optimize ${variables.pageUrl.replace(/^https?:\/\/[^\/]+/, '')}: ${error.message}`,
        variant: "destructive"
      });
      setFixingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.pageUrl);
        return newSet;
      });
    }
  });

  const handleFixPage = async (pageUrl: string, page: any) => {
    setFixingPages(prev => new Set(prev).add(pageUrl));
    fixPageMutation.mutate({ pageUrl, page });
  };

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
      {/* SEO Improvements Banner */}
      {fixedIssuesData?.fixedSummary.totalFixed > 0 && (
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

      {/* Detailed Audit Tabs */}
      <Card>
        <Tabs defaultValue="overview" className="w-full">
          <div className="border-b border-slate-200">
            <div className="px-6 py-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="flex items-center space-x-2">
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center space-x-2">
                  <span>Performance</span>
                </TabsTrigger>
                <TabsTrigger value="technical" className="flex items-center space-x-2">
                  <span>Technical SEO</span>
                </TabsTrigger>
                <TabsTrigger value="keywords" className="flex items-center space-x-2">
                  <span>Keywords</span>
                </TabsTrigger>
                <TabsTrigger value="content" className="flex items-center space-x-2">
                  <span>Content</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <CardContent className="p-6">
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Issues */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Issues</h3>
                  <div className="space-y-3">
                    {results.issues.slice(0, 5).map((issue, index) => (
                      <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg ${
                        issue.severity === 'critical' ? 'bg-red-50' :
                        issue.severity === 'medium' ? 'bg-amber-50' : 'bg-blue-50'
                      }`}>
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
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Search Console (90 days)</h3>
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
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Technical SEO Issues</h3>
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
                            <p className="text-xs text-slate-500 mt-1">Page: {issue.page}</p>
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
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="space-y-6">
                {/* Page Performance Metrics */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Page Performance Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {results.pages?.length || 0}
                      </div>
                      <div className="text-sm text-slate-600">Total Pages</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {results.pages?.filter(page => page.images?.length > 0).length || 0}
                      </div>
                      <div className="text-sm text-slate-600">Pages with Images</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {results.pages?.reduce((total, page) => total + (page.images?.length || 0), 0) || 0}
                      </div>
                      <div className="text-sm text-slate-600">Total Images</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(results.pages?.reduce((total, page) => total + (page.wordCount || 0), 0) / (results.pages?.length || 1)) || 0}
                      </div>
                      <div className="text-sm text-slate-600">Avg Words/Page</div>
                    </div>
                  </div>
                </div>

                {/* Performance Issues */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance-Related Issues</h3>
                  <div className="space-y-3">
                    {results.issues
                      .filter(issue => 
                        issue.type.toLowerCase().includes('image') ||
                        issue.type.toLowerCase().includes('content') ||
                        issue.type.toLowerCase().includes('loading') ||
                        issue.type.toLowerCase().includes('speed') ||
                        issue.type.toLowerCase().includes('size'))
                      .slice(0, 8)
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
                              <p className="text-xs text-slate-500 mt-1">Page: {issue.page}</p>
                            )}
                          </div>
                          <Badge className={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {results.issues.filter(issue => 
                      issue.type.toLowerCase().includes('image') ||
                      issue.type.toLowerCase().includes('content') ||
                      issue.type.toLowerCase().includes('loading') ||
                      issue.type.toLowerCase().includes('speed') ||
                      issue.type.toLowerCase().includes('size')).length === 0 && (
                      <div className="text-center py-6 bg-green-50 rounded-lg">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-green-800 font-medium">No major performance issues detected</p>
                        <p className="text-green-600 text-sm">Your site appears to be optimized for performance</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Optimization Analysis */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Image Optimization</h3>
                  <div className="bg-slate-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 mb-1">
                          {results.pages?.reduce((total, page) => {
                            const missingAlt = page.images?.filter((img: any) => !img.alt).length || 0;
                            return total + missingAlt;
                          }, 0) || 0}
                        </div>
                        <div className="text-sm text-slate-600">Images Missing Alt Text</div>
                        <div className="text-xs text-slate-500 mt-1">Affects accessibility & SEO</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 mb-1">
                          {results.pages?.reduce((total, page) => {
                            const withAlt = page.images?.filter((img: any) => img.alt).length || 0;
                            return total + withAlt;
                          }, 0) || 0}
                        </div>
                        <div className="text-sm text-slate-600">Optimized Images</div>
                        <div className="text-xs text-slate-500 mt-1">With proper alt text</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900 mb-1">
                          {results.pages?.reduce((total, page) => {
                            const totalImages = page.images?.length || 0;
                            const optimized = page.images?.filter((img: any) => img.alt).length || 0;
                            return totalImages > 0 ? total + Math.round((optimized / totalImages) * 100) : total;
                          }, 0) / (results.pages?.filter(page => (page.images?.length || 0) > 0).length || 1) || 0}%
                        </div>
                        <div className="text-sm text-slate-600">Optimization Rate</div>
                        <div className="text-xs text-slate-500 mt-1">Overall image optimization</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Performance */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Content Performance</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Page</TableHead>
                          <TableHead>Word Count</TableHead>
                          <TableHead>Images</TableHead>
                          <TableHead>Links</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.pages?.slice(0, 10).map((page, index) => {
                          const needsWork = !(page.wordCount > 300 && page.title && page.metaDescription);
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="max-w-xs truncate">
                                  {page.url?.replace(results.url, '') || '/'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={page.wordCount > 300 ? 'text-green-600' : page.wordCount > 150 ? 'text-amber-600' : 'text-red-600'}>
                                  {page.wordCount || 0}
                                </span>
                              </TableCell>
                              <TableCell>{page.images?.length || 0}</TableCell>
                              <TableCell>{(page.internalLinks?.length || 0) + (page.externalLinks?.length || 0)}</TableCell>
                              <TableCell>
                                <Badge variant={needsWork ? 'secondary' : 'default'}>
                                  {needsWork ? 'Needs Work' : 'Optimized'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {needsWork && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleFixPage(page.url, page)}
                                    disabled={fixingPages.has(page.url)}
                                    className="text-xs"
                                  >
                                    {fixingPages.has(page.url) ? "Fixing..." : "Fix"}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* PageSpeed Insights (if available) */}
                {results.pageSpeedData && Object.keys(results.pageSpeedData).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">PageSpeed Insights</h3>
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
                )}
              </div>
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
                            <TableCell className="text-slate-600">{keyword.ctr.toFixed(2)}%</TableCell>
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
              </div>
            </TabsContent>

            <TabsContent value="content">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Content Analysis</h3>
                  <div className="space-y-4">
                    {results.issues
                      .filter(issue => 
                        issue.type.toLowerCase().includes('content') ||
                        issue.type.toLowerCase().includes('meta') ||
                        issue.type.toLowerCase().includes('title') ||
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
                              <p className="text-xs text-slate-500 mt-1">Page: {issue.page}</p>
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
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}