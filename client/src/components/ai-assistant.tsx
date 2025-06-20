import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText, Lightbulb, Calendar, Zap, Edit, Copy, RefreshCw, Plus, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIAssistantProps {
  auditId: number;
}

export function AIAssistant({ auditId }: AIAssistantProps) {
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [expandedResolution, setExpandedResolution] = useState<string | null>(null);
  const [generatedBlogPost, setGeneratedBlogPost] = useState<any>(null);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isWritingBlog, setIsWritingBlog] = useState(false);
  const [blogContent, setBlogContent] = useState('');
  const [isEditingBlog, setIsEditingBlog] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [showCustomBlogForm, setShowCustomBlogForm] = useState(false);
  const blogSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch AI-generated issue resolutions
  const { data: resolutions, isLoading: resolutionsLoading } = useQuery({
    queryKey: [`/api/audits/${auditId}/resolutions`],
    queryFn: async () => {
      const response = await fetch(`/api/audits/${auditId}/resolutions`);
      if (!response.ok) throw new Error('Failed to fetch resolutions');
      return response.json();
    }
  });

  // Fetch blog strategy
  const { data: blogStrategy, isLoading: strategyLoading } = useQuery({
    queryKey: [`/api/audits/${auditId}/blog-strategy`],
    queryFn: async () => {
      const response = await fetch(`/api/audits/${auditId}/blog-strategy`);
      if (!response.ok) throw new Error('Failed to fetch blog strategy');
      return response.json();
    }
  });

  // Simulate real-time blog writing
  const simulateTyping = (text: string, onUpdate: (partial: string) => void) => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        onUpdate(text.substring(0, currentIndex));
        currentIndex += Math.random() * 8 + 2; // Variable typing speed
      } else {
        clearInterval(interval);
      }
    }, 50);
    return interval;
  };

  // Scroll to blog section
  const scrollToBlogSection = () => {
    if (blogSectionRef.current) {
      blogSectionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  // Write blog post mutation with real-time simulation
  const writeBlogMutation = useMutation({
    mutationFn: async (topic: any) => {
      setIsWritingBlog(true);
      setBlogContent('');
      scrollToBlogSection();
      
      const response = await apiRequest("POST", `/api/audits/${auditId}/write-blog`, { topic });
      const result = await response.json();
      
      // Simulate real-time writing
      return new Promise((resolve) => {
        const fullContent = result.blogPost?.content || '';
        simulateTyping(fullContent, (partial) => {
          setBlogContent(partial);
        });
        
        // Complete after typing simulation
        setTimeout(() => {
          setIsWritingBlog(false);
          setGeneratedBlogPost(result.blogPost);
          resolve(result);
        }, Math.min(fullContent.length * 50, 10000)); // Max 10 seconds
      });
    },
    onSuccess: (data) => {
      setGeneratedBlogPost(data.blogPost);
    }
  });

  // Apply SEO fix mutation
  const applyFixMutation = useMutation({
    mutationFn: async (fix: any) => {
      const response = await apiRequest("POST", `/api/audits/${auditId}/apply-fix`, { fix });
      return response.json();
    },
    onSuccess: (data) => {
      setApplyingFix(null);
      if (data.success) {
        toast({
          title: "SEO Fix Applied Successfully",
          description: data.message || "The SEO fix has been applied to your WordPress site.",
        });
      } else {
        toast({
          title: "Fix Application Failed",
          description: data.message || "Unable to apply the SEO fix. Please check your WordPress credentials.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setApplyingFix(null);
      toast({
        title: "Error Applying Fix",
        description: "Something went wrong while applying the SEO fix. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Generate content calendar mutation
  const generateCalendarMutation = useMutation({
    mutationFn: async (blogTopics: any[]) => {
      const response = await apiRequest("POST", `/api/audits/${auditId}/content-calendar`, { blogTopics });
      return response.json();
    }
  });

  // Custom AI blog generator mutation
  const customBlogMutation = useMutation({
    mutationFn: async ({ topic, industry }: { topic: string; industry: string }) => {
      setIsWritingBlog(true);
      setBlogContent('');
      scrollToBlogSection();
      
      const response = await apiRequest("POST", `/api/audits/${auditId}/write-custom-blog`, { 
        topic, 
        industry 
      });
      const result = await response.json();
      
      // Simulate real-time writing
      return new Promise((resolve) => {
        const fullContent = result.blogPost?.content || '';
        simulateTyping(fullContent, (partial) => {
          setBlogContent(partial);
        });
        
        // Complete after typing simulation
        setTimeout(() => {
          setIsWritingBlog(false);
          setGeneratedBlogPost(result.blogPost);
          resolve(result);
        }, Math.min(fullContent.length * 50, 10000)); // Max 10 seconds
      });
    },
    onSuccess: () => {
      setShowCustomBlogForm(false);
      setCustomTopic('');
      setCustomIndustry('');
      toast({
        title: "Custom blog post generated!",
        description: "Your SEO-optimized blog post is ready.",
      });
    },
    onError: (error) => {
      setIsWritingBlog(false);
      console.error('Error generating custom blog:', error);
      toast({
        title: "Error generating custom blog",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  });

  const handleWriteBlog = async (topic: any) => {
    setSelectedTopic(topic);
    await writeBlogMutation.mutateAsync(topic);
  };

  const handleCustomBlog = () => {
    if (customTopic.trim() && customIndustry.trim()) {
      customBlogMutation.mutate({ topic: customTopic, industry: customIndustry });
    }
  };

  const handleRegenerateBlog = () => {
    if (selectedTopic) {
      writeBlogMutation.mutate(selectedTopic);
    } else if (generatedBlogPost) {
      const topic = {
        title: generatedBlogPost.title,
        targetKeyword: generatedBlogPost.title.split(' ').slice(0, 3).join(' '),
        metaDescription: generatedBlogPost.metaDescription
      };
      writeBlogMutation.mutate(topic);
    }
  };

  const handleCopyBlog = () => {
    if (generatedBlogPost?.content) {
      navigator.clipboard.writeText(generatedBlogPost.content);
      toast({
        title: "Blog content copied!",
        description: "The blog content has been copied to your clipboard.",
      });
    }
  };

  const handleGenerateCalendar = async () => {
    if (blogStrategy?.blogTopics) {
      await generateCalendarMutation.mutateAsync(blogStrategy.blogTopics);
    }
  };

  const handleApplyFix = async (resolution: any) => {
    const fixId = `${resolution.issueType}-${Date.now()}`;
    setApplyingFix(fixId);
    
    // Convert resolution to WordPress SEO fix format
    const fix = {
      type: 'meta_description', // This would be determined based on resolution.issueType
      postId: 0, // This would need to be determined from the resolution context
      currentValue: '',
      newValue: resolution.actionPlan?.technicalDetails || '',
      description: resolution.actionPlan?.overview || ''
    };
    
    await applyFixMutation.mutateAsync(fix);
  };

  const testWordPressConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch('/api/wordpress/test-connection');
      const data = await response.json();
      
      if (data.connected) {
        toast({
          title: "WordPress Connection Successful",
          description: "Ready to apply SEO fixes automatically to your WordPress site.",
        });
      } else {
        toast({
          title: "WordPress Connection Failed",
          description: "Please check your WordPress credentials in the environment settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Unable to test WordPress connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold">AI SEO Assistant</h2>
        <Badge variant="outline">Powered by OpenAI</Badge>
      </div>

      <Tabs defaultValue="resolutions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resolutions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Fix Issues
          </TabsTrigger>
          <TabsTrigger value="blog-strategy" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Blog Strategy
          </TabsTrigger>
          <TabsTrigger value="content-calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Content Calendar
          </TabsTrigger>
        </TabsList>

        {/* Issue Resolutions Tab */}
        <TabsContent value="resolutions" className="space-y-4">
          {resolutionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Analyzing issues and generating solutions...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* WordPress Connection Status */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">WordPress Integration</CardTitle>
                      <CardDescription>
                        Test your WordPress connection to enable automatic SEO fix application
                      </CardDescription>
                    </div>
                    <Button
                      onClick={testWordPressConnection}
                      disabled={testingConnection}
                      variant="outline"
                      size="sm"
                    >
                      {testingConnection ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
              {/* Critical Issues */}
              {resolutions?.criticalResolutions?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Critical Issues - Immediate Action Required</CardTitle>
                    <CardDescription>
                      These issues are severely impacting your SEO performance and should be fixed immediately.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resolutions.criticalResolutions.map((resolution: any, index: number) => (
                      <ResolutionCard
                        key={index}
                        resolution={resolution}
                        isExpanded={expandedResolution === `critical-${index}`}
                        onToggle={() => setExpandedResolution(
                          expandedResolution === `critical-${index}` ? null : `critical-${index}`
                        )}
                        onApplyFix={handleApplyFix}
                        isApplying={applyingFix === `${resolution.issueType}-${index}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Medium Priority Issues */}
              {resolutions?.mediumResolutions?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-orange-600">Medium Priority Issues</CardTitle>
                    <CardDescription>
                      Important optimizations that will improve your SEO performance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resolutions.mediumResolutions.map((resolution: any, index: number) => (
                      <ResolutionCard
                        key={index}
                        resolution={resolution}
                        isExpanded={expandedResolution === `medium-${index}`}
                        onToggle={() => setExpandedResolution(
                          expandedResolution === `medium-${index}` ? null : `medium-${index}`
                        )}
                        onApplyFix={handleApplyFix}
                        isApplying={applyingFix === `${resolution.issueType}-${index}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Quick Wins */}
              {resolutions?.quickWins?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Quick Wins - Easy Improvements</CardTitle>
                    <CardDescription>
                      Low-effort, high-impact optimizations you can implement right away.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {resolutions.quickWins.map((resolution: any, index: number) => (
                      <ResolutionCard
                        key={index}
                        resolution={resolution}
                        isExpanded={expandedResolution === `quick-${index}`}
                        onToggle={() => setExpandedResolution(
                          expandedResolution === `quick-${index}` ? null : `quick-${index}`
                        )}
                        onApplyFix={handleApplyFix}
                        isApplying={applyingFix === `${resolution.issueType}-${index}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Blog Strategy Tab */}
        <TabsContent value="blog-strategy" className="space-y-4">
          {strategyLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Creating personalized blog strategy...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Strategy Overview */}
              {blogStrategy?.strategy && (
                <Card>
                  <CardHeader>
                    <CardTitle>Content Strategy Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Strategic Approach</h4>
                      <p className="text-gray-600">{blogStrategy.strategy.overview}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Target Audience</h4>
                      <p className="text-gray-600">{blogStrategy.strategy.targetAudience}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Content Pillars</h4>
                      <div className="flex flex-wrap gap-2">
                        {blogStrategy.strategy.contentPillars?.map((pillar: string, index: number) => (
                          <Badge key={index} variant="outline">{pillar}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Publishing Schedule</h4>
                      <p className="text-gray-600">{blogStrategy.strategy.publishingFrequency}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Blog Generator */}
              <Card className="border-2 border-dashed border-blue-300 bg-blue-50/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-blue-600" />
                        Ask AI to Write a New Blog
                      </CardTitle>
                      <CardDescription>
                        Generate a custom SEO-optimized blog post on any topic you choose
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setShowCustomBlogForm(!showCustomBlogForm)}
                      variant="outline"
                      size="sm"
                    >
                      {showCustomBlogForm ? 'Cancel' : 'Create Custom Blog'}
                    </Button>
                  </div>
                </CardHeader>
                {showCustomBlogForm && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customTopic">Blog Topic</Label>
                        <Input
                          id="customTopic"
                          placeholder="e.g., AI automation trends in 2025"
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customIndustry">Industry Focus</Label>
                        <Input
                          id="customIndustry"
                          placeholder="e.g., Technology, Healthcare, Finance"
                          value={customIndustry}
                          onChange={(e) => setCustomIndustry(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleCustomBlog}
                      disabled={!customTopic.trim() || !customIndustry.trim() || customBlogMutation.isPending}
                      className="w-full"
                    >
                      {customBlogMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating SEO-Optimized Blog...
                        </>
                      ) : (
                        'Generate Custom Blog Post'
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* Blog Topics */}
              {blogStrategy?.blogTopics?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>SEO-Optimized Blog Topics</CardTitle>
                    <CardDescription>
                      AI-generated blog topics targeting your keyword opportunities
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {blogStrategy.blogTopics.map((topic: any, index: number) => (
                      <BlogTopicCard
                        key={index}
                        topic={topic}
                        onWriteBlog={() => handleWriteBlog(topic)}
                        isWriting={writeBlogMutation.isPending && selectedTopic === topic}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Content Calendar Tab */}
        <TabsContent value="content-calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Calendar</CardTitle>
              <CardDescription>
                Generate a 3-month content publishing schedule based on your blog strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleGenerateCalendar}
                disabled={generateCalendarMutation.isPending || !blogStrategy?.blogTopics}
                className="mb-4"
              >
                {generateCalendarMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating Calendar...
                  </>
                ) : (
                  'Generate Content Calendar'
                )}
              </Button>

              {generateCalendarMutation.data && (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Calendar Summary</h4>
                    <p>Total Posts: {generateCalendarMutation.data.summary?.totalPosts}</p>
                    <p>Weekly Frequency: {generateCalendarMutation.data.summary?.weeklyFrequency}</p>
                    <p>Expected SEO Impact: {generateCalendarMutation.data.summary?.expectedSeoImpact}</p>
                  </div>
                  
                  {/* Calendar months would be rendered here */}
                  <div className="text-sm text-gray-600">
                    Calendar details and scheduling interface would be implemented here
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Blog Post Display */}
      {generatedBlogPost && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Blog Post</CardTitle>
            <CardDescription>
              Your AI-written blog post is ready! Copy and paste into your CMS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BlogPostDisplay blogPost={generatedBlogPost} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResolutionCard({ resolution, isExpanded, onToggle, onApplyFix, isApplying }: any) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <h4 className="font-semibold">{resolution.issueType}</h4>
              <p className="text-sm text-gray-600">{resolution.actionPlan?.overview}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPriorityColor(resolution.priority)}>{resolution.priority}</Badge>
            <Badge className={getDifficultyColor(resolution.difficulty)}>{resolution.difficulty}</Badge>
            <span className="text-xs text-gray-500">{resolution.timeToComplete}</span>
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="p-4 border-l-4 border-blue-200 ml-4 space-y-4">
        <div>
          <h5 className="font-semibold mb-2">Action Steps</h5>
          <ol className="list-decimal list-inside space-y-1">
            {resolution.actionPlan?.steps?.map((step: string, index: number) => (
              <li key={index} className="text-sm">{step}</li>
            ))}
          </ol>
        </div>
        
        {resolution.actionPlan?.technicalDetails && (
          <div>
            <h5 className="font-semibold mb-2">Technical Details</h5>
            <p className="text-sm text-gray-600">{resolution.actionPlan.technicalDetails}</p>
          </div>
        )}
        
        {resolution.actionPlan?.codeExample && (
          <div>
            <h5 className="font-semibold mb-2">Code Example</h5>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
              <code>{resolution.actionPlan.codeExample}</code>
            </pre>
          </div>
        )}
        
        <div>
          <h5 className="font-semibold mb-2">Expected Outcome</h5>
          <p className="text-sm text-gray-600">{resolution.expectedOutcome}</p>
        </div>
        
        {resolution.tools?.length > 0 && (
          <div>
            <h5 className="font-semibold mb-2">Tools Needed</h5>
            <div className="flex flex-wrap gap-1">
              {resolution.tools.map((tool: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">{tool}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Apply Fix Button */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Ready to apply this fix to your WordPress site?
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onApplyFix && onApplyFix(resolution);
              }}
              disabled={isApplying}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {isApplying ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Applying...
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Apply Fix
                </>
              )}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BlogTopicCard({ topic, onWriteBlog, isWriting }: any) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{topic.title}</h4>
          <p className="text-sm text-gray-600 mt-1">Target: {topic.targetKeyword}</p>
        </div>
        <Button 
          onClick={onWriteBlog}
          disabled={isWriting}
          size="sm"
        >
          {isWriting ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
              Writing...
            </>
          ) : (
            'Write Blog Post'
          )}
        </Button>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <Badge className={getDifficultyColor(topic.difficulty)}>{topic.difficulty}</Badge>
        <span className="text-gray-500">~{topic.wordCount} words</span>
        <span className="text-gray-500">{topic.contentType}</span>
      </div>
      
      {topic.outline && (
        <div>
          <h5 className="font-medium text-sm mb-2">Content Outline</h5>
          <ul className="text-xs text-gray-600 space-y-1">
            {topic.outline.map((section: string, index: number) => (
              <li key={index}>• {section}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BlogPostDisplay({ blogPost }: any) {
  if (!blogPost) return null;
  
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">SEO Title</h4>
        <p className="text-sm bg-gray-100 p-2 rounded">{blogPost.title}</p>
      </div>
      
      <div>
        <h4 className="font-semibold">Meta Description</h4>
        <p className="text-sm bg-gray-100 p-2 rounded">{blogPost.metaDescription}</p>
      </div>
      
      <div>
        <h4 className="font-semibold">Blog Content</h4>
        <Textarea 
          value={blogPost.content} 
          readOnly
          className="min-h-[400px] font-mono text-sm"
        />
      </div>
      
      {blogPost.internalLinks?.length > 0 && (
        <div>
          <h4 className="font-semibold">Suggested Internal Links</h4>
          <ul className="space-y-2">
            {blogPost.internalLinks.map((link: any, index: number) => (
              <li key={index} className="text-sm">
                <strong>{link.anchorText}</strong> → {link.targetPage}
                <p className="text-gray-600 text-xs">{link.context}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <Button className="w-full">
        Copy Blog Post Content
      </Button>
    </div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'default';
  }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'easy': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'hard': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}