import OpenAI from "openai";
import { AuditResultsType } from '@shared/schema';

export class BlogWriterService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateBlogStrategy(auditResults: AuditResultsType): Promise<BlogStrategy> {
    const topQueries = auditResults.gscData?.topQueries?.slice(0, 15) || [];
    const keywordOpportunities = auditResults.keywordOpportunities?.slice(0, 10) || [];

    const prompt = `
You are an expert content strategist. Based on this SEO audit data for ${auditResults.url}, create a comprehensive blog strategy to improve SEO performance.

Current Performance:
- Industry: ${auditResults.industry}
- SEO Score: ${auditResults.stats.seoScore}/100
- Current clicks: ${auditResults.gscData?.totalClicks || 0}
- Average position: ${auditResults.gscData?.avgPosition || 'N/A'}

Top Performing Queries:
${topQueries.map(q => `- "${q.query}" (Position: ${q.position.toFixed(1)}, ${q.clicks} clicks)`).join('\n')}

Keyword Opportunities:
${keywordOpportunities.map(k => `- "${k.keyword}" (${k.searchVolume} searches, ${k.competition} competition)`).join('\n')}

Create a blog strategy focusing on improving SEO through targeted content. Respond with JSON:

{
  "strategy": {
    "overview": "Strategic approach to blog content for SEO improvement",
    "targetAudience": "Primary audience description",
    "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
    "publishingFrequency": "Recommended posting schedule"
  },
  "blogTopics": [
    {
      "title": "Compelling blog post title",
      "targetKeyword": "primary keyword",
      "secondaryKeywords": ["keyword1", "keyword2"],
      "searchVolume": "estimated monthly searches",
      "difficulty": "easy|medium|hard",
      "contentType": "how-to|comparison|case-study|news|opinion",
      "wordCount": "recommended word count",
      "outline": ["H2 section 1", "H2 section 2", "H2 section 3"],
      "seoGoal": "what this post aims to achieve",
      "estimatedRankingPotential": "position 1-3|4-10|11-20"
    }
  ]
}

Provide 8-12 blog topic ideas that target different keyword opportunities and address SEO weaknesses.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert content strategist creating SEO-focused blog strategies. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      const result = JSON.parse(response.choices[0].message.content || '{"strategy": {}, "blogTopics": []}');
      return result;
    } catch (error) {
      console.error('Error generating blog strategy:', error);
      return { strategy: {}, blogTopics: [] };
    }
  }

  async writeBlogPost(topic: BlogTopic, auditResults: AuditResultsType): Promise<BlogPost> {
    const prompt = `
Write a comprehensive, SEO-optimized blog post based on this topic for ${auditResults.url}.

Blog Topic Details:
- Title: ${topic.title}
- Target Keyword: ${topic.targetKeyword}
- Secondary Keywords: ${topic.secondaryKeywords?.join(', ')}
- Content Type: ${topic.contentType}
- Target Word Count: ${topic.wordCount}
- Industry Context: ${auditResults.industry}

Outline to follow:
${topic.outline?.join('\n')}

Requirements:
1. Write engaging, informative content that naturally incorporates keywords
2. Include proper heading structure (H1, H2, H3)
3. Add meta description and title tag
4. Include internal linking suggestions
5. Optimize for featured snippets where possible
6. Include a compelling introduction and conclusion
7. Add FAQ section if relevant

Respond with JSON:
{
  "post": {
    "title": "SEO-optimized title (55-60 characters)",
    "metaDescription": "Compelling meta description (150-160 characters)",
    "slug": "url-friendly-slug",
    "content": "Full blog post content with proper HTML formatting",
    "headings": {
      "h1": "Main heading",
      "h2": ["List of H2 headings"],
      "h3": ["List of H3 headings"]
    },
    "internalLinks": [
      {
        "anchorText": "suggested anchor text",
        "targetPage": "suggested internal page to link to",
        "context": "why this link adds value"
      }
    ],
    "featuredSnippetOptimization": {
      "question": "Question this content answers",
      "answer": "Concise answer (40-50 words)",
      "format": "paragraph|list|table"
    },
    "faq": [
      {
        "question": "Relevant question",
        "answer": "Clear, concise answer"
      }
    ],
    "callToAction": "Compelling CTA that aligns with business goals"
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
            content: "You are an expert SEO content writer. Create high-quality, optimized blog posts that rank well and provide value. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"post": {}}');
      return result.post;
    } catch (error) {
      console.error('Error writing blog post:', error);
      return {} as BlogPost;
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

export interface BlogTopic {
  title: string;
  targetKeyword: string;
  secondaryKeywords?: string[];
  searchVolume: string;
  difficulty: 'easy' | 'medium' | 'hard';
  contentType: string;
  wordCount: string;
  outline?: string[];
  seoGoal: string;
  estimatedRankingPotential: string;
}

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