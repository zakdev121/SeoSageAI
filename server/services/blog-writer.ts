import OpenAI from "openai";
import { AuditResultsType } from '@shared/schema';
import { blogTemplateEngine, BlogTopic } from './blog-template-engine';
import { trendResearch } from './trend-research';

export class BlogWriterService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateBlogStrategy(auditResults: AuditResultsType): Promise<BlogStrategy> {
    console.log('Generating trending blog strategy with real-time insights...');
    
    // Extract GSC keyword data for trend research
    const gscKeywords = auditResults.gscData?.topQueries?.slice(0, 15) || [];
    const keywordOpportunities = auditResults.keywordOpportunities?.slice(0, 10) || [];

    try {
      // Generate trending topics using template engine and trend research
      const trendingTopics = await blogTemplateEngine.generateTrendingTopics(
        auditResults.industry, 
        gscKeywords
      );

      // Generate strategy overview with current performance context
      const strategy = await this.generateStrategyOverview(auditResults, trendingTopics);

      return {
        strategy,
        blogTopics: trendingTopics
      };
    } catch (error) {
      console.error('Error generating trending blog strategy:', error);
      
      // Fallback to basic strategy if trend research fails
      return await this.generateBasicStrategy(auditResults);
    }
  }

  /**
   * Generate comprehensive strategy overview
   */
  private async generateStrategyOverview(auditResults: AuditResultsType, topics: BlogTopic[]): Promise<any> {
    const prompt = `
Based on this SEO audit data and trending blog topics, create a strategic overview:

Website: ${auditResults.url}
Industry: ${auditResults.industry}
Current SEO Score: ${auditResults.stats.seoScore}/100
Current Traffic: ${auditResults.gscData?.totalClicks || 0} clicks

Generated Topics (based on current trends):
${Array.isArray(topics) && topics.length > 0 ? topics.map(t => `- ${t.title} (${t.targetKeyword})`).join('\n') : '- No trending topics generated yet'}

Create a comprehensive content strategy that explains:
1. How these trending topics align with business goals
2. Target audience segmentation
3. Content pillar strategy
4. Publishing frequency recommendations
5. Expected SEO impact timeline

Return as JSON: {
  "overview": "Strategic overview paragraph",
  "targetAudience": "Primary audience description", 
  "contentPillars": ["pillar1", "pillar2", "pillar3"],
  "publishingFrequency": "Recommended schedule"
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error generating strategy overview:', error);
      return {
        overview: `Strategic content approach for ${auditResults.industry} industry focusing on trending topics and SEO optimization`,
        targetAudience: "Business professionals and decision makers",
        contentPillars: ["Industry Insights", "Best Practices", "Innovation Trends"],
        publishingFrequency: "2-3 posts per week"
      };
    }
  }

  /**
   * Fallback basic strategy generation
   */
  private async generateBasicStrategy(auditResults: AuditResultsType): Promise<BlogStrategy> {
    const topQueries = auditResults.gscData?.topQueries?.slice(0, 8) || [];
    const keywordOpportunities = auditResults.keywordOpportunities?.slice(0, 5) || [];

    const basicTopics: BlogTopic[] = [
      ...topQueries.map(q => ({
        title: this.createTitleFromKeyword(q.query),
        targetKeyword: q.query,
        metaDescription: `Comprehensive guide to ${q.query} - expert insights and best practices`,
        seoKeywords: [q.query, `${q.query} guide`, `${q.query} tips`, `${q.query} best practices`],
        contentType: 'guide',
        contentAngle: 'Comprehensive how-to guide',
        targetAudience: 'Business professionals'
      })),
      ...keywordOpportunities.map(k => ({
        title: this.createTitleFromKeyword(k.keyword),
        targetKeyword: k.keyword,
        metaDescription: `Everything you need to know about ${k.keyword} - practical advice and strategies`,
        seoKeywords: [k.keyword, `${k.keyword} analysis`, `${k.keyword} strategy`, `${k.keyword} trends`],
        contentType: 'analysis',
        contentAngle: 'Strategic analysis and insights',
        targetAudience: 'Decision makers and analysts'
      }))
    ].slice(0, 8);

    return {
      strategy: {
        overview: `Content strategy targeting high-opportunity keywords for ${auditResults.industry}`,
        targetAudience: "Industry professionals and potential customers",
        contentPillars: ["Educational Content", "Industry Insights", "Practical Guides"],
        publishingFrequency: "Weekly"
      },
      blogTopics: basicTopics
    };
  }

  /**
   * Create SEO-optimized title from keyword
   */
  private createTitleFromKeyword(keyword: string): string {
    const words = keyword.split(' ');
    const capitalized = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    const titlePrefixes = [
      'Complete Guide to',
      'Ultimate Guide to',
      'Everything About',
      'Mastering',
      'Understanding'
    ];
    
    const prefix = titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)];
    return `${prefix} ${capitalized}`;
  }

  /**
   * Use GPT to determine the best image keywords for blog content
   */
  private async getImageKeywordsFromGPT(topic: BlogTopic): Promise<string[]> {
    const prompt = `
Based on this blog topic, suggest 5-7 specific image search keywords that would be most relevant and visually appealing:

Topic: ${topic.title}
Content Type: ${topic.contentType}
Keywords: ${topic.seoKeywords?.join(', ') || topic.targetKeyword}
Type: ${topic.contentType}

Provide image keywords that are:
- Visually compelling and professional
- Relevant to the blog content and industry
- Likely to find high-quality stock photos
- Diverse (mix of concepts, objects, people, abstract)

Return as JSON array: {"keywords": ["keyword1", "keyword2", ...]}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300
      });

      const result = JSON.parse(response.choices[0].message.content || '{"keywords": []}');
      return result.keywords || [];
    } catch (error) {
      console.error('Error getting image keywords from GPT:', error);
      // Fallback to topic-based keywords
      return [
        topic.title.split(' ').slice(0, 2).join(' '),
        topic.contentType || 'business',
        'professional',
        'technology',
        'teamwork'
      ];
    }
  }

  async writeBlogPost(topic: BlogTopic, auditResults: AuditResultsType): Promise<BlogPost> {
    console.log('Generating blog post using template engine...');
    
    try {
      // Use the new template engine for consistent, professional blog generation
      const blogPost = await blogTemplateEngine.generateBlogPost(topic);
      return blogPost;
    } catch (error) {
      console.error('Error using template engine, falling back to direct generation:', error);
      
      // Fallback to direct generation if template engine fails
      return await this.generateBlogPostDirect(topic, auditResults);
    }
  }

  /**
   * Direct blog post generation (fallback method)
   */
  private async generateBlogPostDirect(topic: any, auditResults: AuditResultsType): Promise<BlogPost> {
    const prompt = `
You are an expert content writer and SEO specialist. Write an exceptional, highly engaging blog post that will rank on page 1 of Google and drive significant organic traffic.

BLOG CONTEXT:
- Website: ${auditResults.url}
- Industry: ${auditResults.industry}
- Target Keyword: ${topic.targetKeyword}
- Secondary Keywords: ${topic.secondaryKeywords?.join(', ')}
- Content Type: ${topic.contentType}
- Target Length: 1,500-3,000 words (MANDATORY: Generate complete, full-length content)

CRITICAL REQUIREMENT: You MUST write the COMPLETE blog post content, not a summary or outline. The "content" field must contain the entire 1,500-3,000 word article with full paragraphs, examples, and detailed explanations.

CONTENT REQUIREMENTS:
1. HOOK & ENGAGEMENT:
   - Start with a compelling hook that immediately grabs attention
   - Use conversational, engaging tone that connects with readers
   - Include data, statistics, or surprising facts early
   - Address reader pain points and promise clear solutions

2. SEO OPTIMIZATION:
   - Naturally integrate target keyword 8-12 times throughout content
   - Use semantic keywords and LSI terms related to the topic
   - Optimize for search intent (informational, commercial, transactional)
   - Include keyword in first 100 words, headings, and conclusion

3. CONTENT STRUCTURE:
   - Write scannable content with short paragraphs (2-3 sentences max)
   - Use bullet points, numbered lists, and subheadings
   - Include actionable takeaways and practical tips
   - Add real-world examples and case studies when relevant

4. ENGAGEMENT FACTORS:
   - Write in active voice with strong, descriptive verbs
   - Include rhetorical questions to engage readers
   - Use transitional phrases for smooth flow
   - Add personal insights and expert opinions

5. VALUE & AUTHORITY:
   - Provide comprehensive coverage of the topic
   - Include latest industry trends and best practices
   - Reference credible sources and statistics
   - Offer unique insights not found elsewhere

6. CONVERSION OPTIMIZATION:
   - Include clear, compelling calls-to-action
   - Guide readers toward next steps
   - Build trust through expertise demonstration

Outline to follow:
${topic.outline?.join('\n')}

WRITING GUIDELINES FOR 3,000 WORDS:
- Introduction: 300-400 words with strong hook and problem statement
- Main body: 2,200-2,400 words with 6-8 detailed sections
- Conclusion: 300-400 words with summary and strong CTA
- Use data, examples, case studies throughout
- Include actionable tips and step-by-step processes
- Add industry insights and expert opinions
- Ensure smooth transitions between sections

Respond with JSON:
{
  "post": {
    "title": "SEO-optimized title (55-60 characters) with target keyword",
    "metaDescription": "Compelling meta description (150-160 characters) that drives clicks",
    "slug": "seo-friendly-url-slug-with-target-keyword",
    "content": "WRITE THE COMPLETE FULL-LENGTH ARTICLE (1,500-3,000 words). Do NOT provide a summary or abbreviated version. Write every single paragraph in full detail with proper HTML formatting including <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em> tags. Each section should be 300-500 words minimum. Include comprehensive explanations, multiple examples, case studies, statistics, and actionable insights throughout every section. Make it visually appealing with: compelling introduction and strong call-to-action at the end, bullet points, headings, subheadings, callout quotes, and placeholder image tags. Return in HTML format.",
    "headings": {
      "h1": "Main H1 title with target keyword",
      "h2": ["List of 6-8 H2 section headings with semantic keywords"],
      "h3": ["List of H3 subheadings for detailed breakdowns"]
    },
    "internalLinks": [
      {
        "anchorText": "natural anchor text with keywords",
        "targetPage": "/suggested-internal-page-url",
        "context": "Strategic reason for this internal link placement"
      }
    ],
    "featuredSnippetOptimization": {
      "question": "Direct question this content definitively answers",
      "answer": "Concise, authoritative answer (40-50 words) formatted for snippets",
      "format": "paragraph|list|table"
    },
    "faq": [
      {
        "question": "Highly relevant question readers would search for",
        "answer": "Clear, comprehensive answer with keywords naturally included"
      }
    ],
    "keywordDensity": {
      "targetKeyword": "8-12 natural mentions throughout content",
      "semanticKeywords": ["list", "of", "related", "terms", "used"],
      "lsiKeywords": ["latent", "semantic", "indexing", "terms"]
    },
    "contentStructure": {
      "introduction": "Hook + problem + solution preview (300-400 words)",
      "mainSections": ["Section 1 focus", "Section 2 focus", "etc"],
      "conclusion": "Summary + key takeaways + CTA (300-400 words)"
    },
    "callToAction": "Compelling, specific CTA that drives business goals and includes urgency"
  }
}

Make the content authoritative, engaging, and optimized for search engines while providing genuine value to readers.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert SEO content writer. CRITICAL: You must write COMPLETE, FULL-LENGTH blog posts of 1,500-3,000 words. Do NOT write summaries, outlines, or abbreviated content. Write every paragraph, section, and detail in full. Each section should be 300-500 words minimum. Always respond with valid JSON containing the complete article."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 16000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"post": {}}');
      const blogPost = result.post;

      // Complete the blog post structure with required properties
      const completePost: BlogPost = {
        title: blogPost.title || topic.title,
        metaDescription: blogPost.metaDescription || topic.metaDescription,
        slug: blogPost.slug || topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        content: blogPost.content || '',
        headings: {
          h1: blogPost.title || topic.title,
          h2: [],
          h3: []
        },
        internalLinks: [],
        featuredSnippetOptimization: {
          question: `What is ${topic.targetKeyword}?`,
          answer: blogPost.metaDescription || topic.metaDescription,
          format: 'paragraph'
        },
        faq: [],
        callToAction: 'Contact us to learn more about implementing these strategies for your business.'
      };

      // Extract headings from content if available
      if (completePost.content) {
        const h2Matches = completePost.content.match(/<h2[^>]*>(.*?)<\/h2>/g) || [];
        const h3Matches = completePost.content.match(/<h3[^>]*>(.*?)<\/h3>/g) || [];
        
        completePost.headings.h2 = h2Matches.map(h => h.replace(/<[^>]*>/g, ''));
        completePost.headings.h3 = h3Matches.map(h => h.replace(/<[^>]*>/g, ''));
      }

      return completePost;
    } catch (error) {
      console.error('Error writing blog post:', error);
      // Return a complete fallback BlogPost structure
      return {
        title: topic.title,
        metaDescription: topic.metaDescription,
        slug: topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        content: `<h1>${topic.title}</h1><p>${topic.metaDescription}</p>`,
        headings: {
          h1: topic.title,
          h2: [],
          h3: []
        },
        internalLinks: [],
        featuredSnippetOptimization: {
          question: `What is ${topic.targetKeyword}?`,
          answer: topic.metaDescription,
          format: 'paragraph'
        },
        faq: [],
        callToAction: 'Contact us to learn more about implementing these strategies for your business.'
      };
    }
  }

  async generateContentCalendar(blogTopics: BlogTopic[]): Promise<ContentCalendar> {
    const prompt = `
Create a 3-month content calendar based on these blog topics. Prioritize based on SEO impact and difficulty.

Blog Topics:
${blogTopics.map((topic, i) => `${i + 1}. ${topic.title} (Keyword: ${topic.targetKeyword}, Difficulty: ${topic.difficulty})`).join('\n')}

Consider:
- Publishing frequency (2-3 posts per week recommended)
- Seasonal trends and timing
- Content difficulty and resource requirements
- SEO impact potential
- Content type variety

Respond with JSON:
{
  "calendar": {
    "month1": [
      {
        "week": 1,
        "posts": [
          {
            "title": "Blog post title",
            "publishDate": "YYYY-MM-DD",
            "priority": "high|medium|low",
            "estimatedHours": "time to create",
            "contentType": "type from original topic",
            "targetKeyword": "primary keyword"
          }
        ]
      }
    ],
    "month2": [],
    "month3": []
  },
  "summary": {
    "totalPosts": "number of posts",
    "weeklyFrequency": "posts per week",
    "focusAreas": ["primary content themes"],
    "expectedSeoImpact": "overall expected improvement"
  }
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a content planning expert. Create realistic, SEO-focused content calendars. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{"calendar": {}, "summary": {}}');
      return result;
    } catch (error) {
      console.error('Error generating content calendar:', error);
      return { calendar: {}, summary: {} };
    }
  }
}

export interface BlogStrategy {
  strategy: {
    overview: string;
    targetAudience: string;
    contentPillars: string[];
    publishingFrequency: string;
  };
  blogTopics: BlogTopic[];
}

// BlogTopic interface is now imported from blog-template-engine

export interface BlogPost {
  title: string;
  metaDescription: string;
  slug: string;
  content: string;
  headings: {
    h1: string;
    h2: string[];
    h3: string[];
  };
  internalLinks: Array<{
    anchorText: string;
    targetPage: string;
    context: string;
  }>;
  featuredSnippetOptimization: {
    question: string;
    answer: string;
    format: string;
  };
  faq: Array<{
    question: string;
    answer: string;
  }>;
  callToAction: string;
}

export interface ContentCalendar {
  calendar: {
    [key: string]: Array<{
      week: number;
      posts: Array<{
        title: string;
        publishDate: string;
        priority: string;
        estimatedHours: string;
        contentType: string;
        targetKeyword: string;
      }>;
    }>;
  };
  summary: {
    totalPosts: string;
    weeklyFrequency: string;
    focusAreas: string[];
    expectedSeoImpact: string;
  };
}