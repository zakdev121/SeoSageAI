import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText, Lightbulb, Calendar, Zap, Edit, Copy, RefreshCw, Plus, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
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
  const [currentWordCount, setCurrentWordCount] = useState(0);
  const [customTopic, setCustomTopic] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [showCustomBlogForm, setShowCustomBlogForm] = useState(false);
  const blogSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Helper function to count words without HTML tags
  const countWordsWithoutHTML = (htmlContent: string) => {
    if (!htmlContent) return 0;
    const textOnly = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return textOnly ? textOnly.split(' ').length : 0;
  };

  // Update word count whenever blog content changes
  useEffect(() => {
    const content = isWritingBlog ? blogContent : (generatedBlogPost?.content || '');
    setCurrentWordCount(countWordsWithoutHTML(content));
  }, [blogContent, generatedBlogPost?.content, isWritingBlog]);

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

  // Write blog post mutation with real-time streaming
  const writeBlogMutation = useMutation({
    mutationFn: async (topic: any) => {
      setIsWritingBlog(true);
      setBlogContent('');
      scrollToBlogSection();
      
      return new Promise(async (resolve, reject) => {
        try {
          const response = await fetch(`/api/audits/${auditId}/write-blog`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, stream: true })
          });

          if (!response.ok) {
            throw new Error('Failed to start streaming');
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body reader available');
          }

          let fullContent = '';
          let blogPostData = null;
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.type === 'content') {
                    fullContent += data.content;
                    setBlogContent(fullContent);
                  } else if (data.type === 'complete') {
                    setIsWritingBlog(false);
                    blogPostData = {
                      title: topic.title,
                      content: fullContent,
                      metaDescription: topic.metaDescription
                    };
                    setGeneratedBlogPost(blogPostData);
                    resolve({ blogPost: blogPostData });
                    return;
                  } else if (data.type === 'error') {
                    setIsWritingBlog(false);
                    reject(new Error(data.error));
                    return;
                  }
                } catch (parseError) {
                  console.log('Non-JSON line:', line);
                }
              }
            }
          }
          
          // If we reach here without completion, finish the blog post
          if (fullContent && !blogPostData) {
            setIsWritingBlog(false);
            blogPostData = {
              title: topic.title,
              content: fullContent,
              metaDescription: topic.metaDescription
            };
            setGeneratedBlogPost(blogPostData);
            resolve({ blogPost: blogPostData });
          }
        } catch (error) {
          setIsWritingBlog(false);
          reject(error);
        }
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

  // Custom AI blog generator mutation with streaming
  const customBlogMutation = useMutation({
    mutationFn: async ({ topic, industry }: { topic: string; industry: string }) => {
      setIsWritingBlog(true);
      setBlogContent('');
      scrollToBlogSection();
      
      return new Promise(async (resolve, reject) => {
        try {
          const response = await fetch(`/api/audits/${auditId}/write-custom-blog`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, industry, stream: true })
          });

          if (!response.ok) {
            throw new Error('Failed to start streaming');
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body reader available');
          }

          let fullContent = '';
          let blogPostData = null;
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.type === 'content') {
                    fullContent += data.content;
                    setBlogContent(fullContent);
                  } else if (data.type === 'complete') {
                    setIsWritingBlog(false);
                    blogPostData = {
                      title: topic,
                      content: fullContent,
                      metaDescription: `Comprehensive guide about ${topic} in the ${industry} industry.`
                    };
                    setGeneratedBlogPost(blogPostData);
                    resolve({ blogPost: blogPostData });
                    return;
                  } else if (data.type === 'error') {
                    setIsWritingBlog(false);
                    reject(new Error(data.error));
                    return;
                  }
                } catch (parseError) {
                  console.log('Non-JSON line:', line);
                }
              }
            }
          }
          
          // If we reach here without completion, finish the blog post
          if (fullContent && !blogPostData) {
            setIsWritingBlog(false);
            blogPostData = {
              title: topic,
              content: fullContent,
              metaDescription: `Comprehensive guide about ${topic} in the ${industry} industry.`
            };
            setGeneratedBlogPost(blogPostData);
            resolve({ blogPost: blogPostData });
          }
        } catch (error) {
          setIsWritingBlog(false);
          reject(error);
        }
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

      {/* Enhanced Blog Post Display with Real-time Writing */}
      <div ref={blogSectionRef}>
        {(isWritingBlog || generatedBlogPost || blogContent) && (
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <CardTitle className="flex items-center gap-2">
                      {isWritingBlog ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          AI is Writing Your Blog Post...
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 text-green-600" />
                          Generated Blog Post
                        </>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full">
                      <span className="text-sm font-medium text-blue-800">
                        {currentWordCount.toLocaleString()} words
                      </span>
                      {isWritingBlog && (
                        <span className="text-xs text-blue-600 animate-pulse">writing...</span>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {isWritingBlog 
                      ? "Watch as AI writes your SEO-optimized content in real-time"
                      : "Your AI-written blog post is ready! Edit, regenerate, or copy the content."
                    }
                  </CardDescription>
                </div>
                
                {!isWritingBlog && generatedBlogPost && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsEditingBlog(!isEditingBlog)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {isEditingBlog ? 'View' : 'Edit'}
                    </Button>
                    <Button
                      onClick={handleRegenerateBlog}
                      variant="outline"
                      size="sm"
                      disabled={writeBlogMutation.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button
                      onClick={handleCopyBlog}
                      size="sm"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isWritingBlog ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[400px] border">
                    <div className="prose max-w-none">
                      <div 
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: blogContent }}
                      />
                      <span className="animate-pulse">|</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Writing in progress... This may take a few moments.
                  </div>
                </div>
              ) : generatedBlogPost ? (
                <div className="space-y-4">
                  {/* Blog Post Meta Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700">Title</h4>
                      <p className="text-sm">{generatedBlogPost.title}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700">Word Count</h4>
                      <p className="text-sm">{countWordsWithoutHTML(generatedBlogPost.content || '')} words</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700">Meta Description</h4>
                      <p className="text-sm">{generatedBlogPost.metaDescription}</p>
                    </div>
                  </div>

                  {/* SEO Quality Checkpoints */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      SEO Quality Score
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <SEOCheckpoint
                        title="Content Length"
                        status={getSEOContentLengthStatus(generatedBlogPost.content)}
                        description="Optimal word count for SEO"
                      />
                      <SEOCheckpoint
                        title="Title Optimization"
                        status={getSEOTitleStatus(generatedBlogPost.title)}
                        description="SEO-friendly title structure"
                      />
                      <SEOCheckpoint
                        title="Meta Description"
                        status={getSEOMetaStatus(generatedBlogPost.metaDescription)}
                        description="Compelling meta description"
                      />
                      <SEOCheckpoint
                        title="Content Structure"
                        status={getSEOStructureStatus(generatedBlogPost.content)}
                        description="Proper heading hierarchy"
                      />
                    </div>
                  </div>
                  
                  {/* Blog Content */}
                  <div className="border rounded-lg">
                    {isEditingBlog ? (
                      <Textarea
                        value={generatedBlogPost.content || ''}
                        onChange={(e) => setGeneratedBlogPost({
                          ...generatedBlogPost,
                          content: e.target.value
                        })}
                        className="min-h-[500px] border-0 resize-none"
                        placeholder="Edit your blog content here..."
                      />
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg max-h-[500px] overflow-y-auto">
                        <div 
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: generatedBlogPost.content || '' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
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

// SEO Checkpoint Component
function SEOCheckpoint({ title, status, description }: { title: string; status: 'excellent' | 'good' | 'needs-improvement'; description: string }) {
  const getStatusIcon = () => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'needs-improvement':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'excellent':
        return 'text-green-800 bg-green-100';
      case 'good':
        return 'text-yellow-800 bg-yellow-100';
      case 'needs-improvement':
        return 'text-red-800 bg-red-100';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'needs-improvement':
        return 'Needs Work';
    }
  };

  return (
    <div className="flex items-start gap-2 p-3 border rounded-lg bg-white">
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h5 className="font-medium text-sm text-gray-900">{title}</h5>
          <Badge className={`text-xs ${getStatusColor()}`}>
            {getStatusText()}
          </Badge>
        </div>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
    </div>
  );
}

// SEO Status Evaluation Functions
function getSEOContentLengthStatus(content: string): 'excellent' | 'good' | 'needs-improvement' {
  const wordCount = Math.round((content?.length || 0) / 5);
  if (wordCount >= 1500) return 'excellent';
  if (wordCount >= 800) return 'good';
  return 'needs-improvement';
}

function getSEOTitleStatus(title: string): 'excellent' | 'good' | 'needs-improvement' {
  const length = title?.length || 0;
  if (length >= 40 && length <= 60) return 'excellent';
  if (length >= 30 && length <= 70) return 'good';
  return 'needs-improvement';
}

function getSEOMetaStatus(metaDescription: string): 'excellent' | 'good' | 'needs-improvement' {
  const length = metaDescription?.length || 0;
  if (length >= 140 && length <= 160) return 'excellent';
  if (length >= 120 && length <= 180) return 'good';
  return 'needs-improvement';
}

function getSEOStructureStatus(content: string): 'excellent' | 'good' | 'needs-improvement' {
  const hasH1 = content?.includes('<h1') || false;
  const hasH2 = content?.includes('<h2') || false;
  const hasH3 = content?.includes('<h3') || false;
  
  if (hasH1 && hasH2 && hasH3) return 'excellent';
  if (hasH1 && hasH2) return 'good';
  return 'needs-improvement';
}