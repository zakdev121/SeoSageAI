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
    "content": "WRITE THE COMPLETE FULL-LENGTH ARTICLE (1,500-3,000 words). Do NOT provide a summary or abbreviated version. Write every single paragraph in full detail with proper HTML formatting including <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em> tags. Each section should be 300-500 words minimum. Include comprehensive explanations, multiple examples, case studies, statistics, and actionable insights throughout every section.",
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