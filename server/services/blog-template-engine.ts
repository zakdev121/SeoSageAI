import OpenAI from "openai";
import { imageService } from "./image-service";
import { trendResearch, TrendInsight } from "./trend-research";

/**
 * Blog Template Engine - Consistent, professional blog generation
 * Uses predefined templates with dynamic content injection
 */
export class BlogTemplateEngine {
  private openai: OpenAI;
  private templates: BlogTemplate[];

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for blog template engine");
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.initializeTemplates();
  }

  /**
   * Generate trending blog topics based on industry and GSC data
   */
  async generateTrendingTopics(industry: string, gscKeywords: any[]): Promise<BlogTopic[]> {
    console.log(`Generating trending topics for industry: ${industry}`);
    
    // Research current trends from multiple sources
    const trendInsights = await trendResearch.researchTrends(industry, gscKeywords.map(k => k.keyword));
    
    // Convert trend insights to blog topics with templates
    const blogTopics = await this.convertTrendsToTopics(trendInsights, industry, gscKeywords);
    
    return blogTopics;
  }

  /**
   * Generate blog post using template system
   */
  async generateBlogPost(topic: BlogTopic): Promise<BlogPost> {
    const template = this.selectOptimalTemplate(topic);
    console.log(`Using template: ${template.name} for topic: ${topic.title}`);

    // Generate content using the selected template
    const content = await this.generateTemplatedContent(topic, template);
    
    // Auto-inject relevant images
    const images = await this.injectRelevantImages(topic, content);
    
    return {
      title: topic.title,
      content: images.content,
      metaDescription: topic.metaDescription,
      targetKeyword: topic.targetKeyword,
      wordCount: this.calculateWordCount(images.content),
      readingTime: this.calculateReadingTime(images.content),
      images: images.imageData,
      seoKeywords: topic.seoKeywords,
      template: template.name,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Initialize blog templates
   */
  private initializeTemplates(): void {
    this.templates = [
      {
        name: "Ultimate Guide",
        description: "Comprehensive guide format for complex topics",
        structure: [
          "introduction",
          "overview",
          "detailed_sections",
          "practical_examples",
          "best_practices",
          "common_mistakes",
          "advanced_tips",
          "conclusion"
        ],
        targetWordCount: 3000,
        seoOptimized: true,
        useCase: "educational, how-to, comprehensive coverage"
      },
      {
        name: "Trend Analysis",
        description: "Current trends and industry insights",
        structure: [
          "trend_introduction",
          "market_analysis",
          "key_players",
          "impact_assessment",
          "future_predictions",
          "actionable_insights",
          "conclusion"
        ],
        targetWordCount: 2500,
        seoOptimized: true,
        useCase: "industry trends, market analysis, predictions"
      },
      {
        name: "Problem-Solution",
        description: "Identifies problems and provides solutions",
        structure: [
          "problem_identification",
          "impact_analysis",
          "root_causes",
          "solution_overview",
          "implementation_steps",
          "case_studies",
          "results_measurement",
          "conclusion"
        ],
        targetWordCount: 2800,
        seoOptimized: true,
        useCase: "problem solving, business solutions, optimization"
      },
      {
        name: "Comparison Guide",
        description: "Compare tools, methods, or approaches",
        structure: [
          "comparison_introduction",
          "evaluation_criteria",
          "option_analysis",
          "pros_cons_breakdown",
          "use_case_scenarios",
          "recommendations",
          "decision_framework",
          "conclusion"
        ],
        targetWordCount: 2600,
        seoOptimized: true,
        useCase: "tool comparisons, method analysis, decision making"
      },
      {
        name: "Strategy Deep-Dive",
        description: "Strategic approach to business challenges",
        structure: [
          "strategy_overview",
          "market_context",
          "strategic_framework",
          "implementation_roadmap",
          "success_metrics",
          "risk_mitigation",
          "real_world_examples",
          "conclusion"
        ],
        targetWordCount: 3200,
        seoOptimized: true,
        useCase: "business strategy, planning, execution"
      }
    ];
  }

  /**
   * Convert trend insights to blog topics
   */
  private async convertTrendsToTopics(insights: TrendInsight[], industry: string, gscKeywords: any[]): Promise<BlogTopic[]> {
    const topicPrompt = `
Based on these trending insights for ${industry} industry:

${JSON.stringify(insights.slice(0, 6), null, 2)}

And these GSC keywords with performance data:
${JSON.stringify(gscKeywords.slice(0, 10), null, 2)}

Generate 8 compelling blog topics that:
1. Leverage current trends and discussions
2. Target high-opportunity GSC keywords
3. Provide unique value and insights
4. Are SEO-optimized for ranking potential
5. Address real audience pain points

For each topic, provide:
- Compelling title (60-65 characters)
- Meta description (150-160 characters)
- Primary target keyword
- Supporting SEO keywords
- Content angle and approach
- Target audience
- Trend source and relevance

Return as JSON: {
  "topics": [{
    "title": "...",
    "metaDescription": "...",
    "targetKeyword": "...",
    "seoKeywords": ["...", "..."],
    "contentAngle": "...",
    "targetAudience": "...",
    "trendSource": "...",
    "contentType": "guide|analysis|comparison|strategy",
    "difficulty": "beginner|intermediate|advanced",
    "businessImpact": "high|medium|low"
  }]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: topicPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 2500
      });

      const result = JSON.parse(response.choices[0].message.content || '{"topics": []}');
      return result.topics || [];
    } catch (error) {
      console.error('Error converting trends to topics:', error);
      return [];
    }
  }

  /**
   * Select optimal template based on topic characteristics
   */
  private selectOptimalTemplate(topic: BlogTopic): BlogTemplate {
    const contentType = topic.contentType?.toLowerCase() || 'guide';
    
    const templateMap: Record<string, string> = {
      'guide': 'Ultimate Guide',
      'analysis': 'Trend Analysis',
      'comparison': 'Comparison Guide',
      'strategy': 'Strategy Deep-Dive',
      'problem': 'Problem-Solution'
    };

    const templateName = templateMap[contentType] || 'Ultimate Guide';
    return this.templates.find(t => t.name === templateName) || this.templates[0];
  }

  /**
   * Generate content using selected template
   */
  private async generateTemplatedContent(topic: BlogTopic, template: BlogTemplate): Promise<string> {
    const contentPrompt = `
Write a comprehensive, engaging blog post using the "${template.name}" template structure.

Topic: ${topic.title}
Target Keyword: ${topic.targetKeyword}
SEO Keywords: ${topic.seoKeywords?.join(', ')}
Content Angle: ${topic.contentAngle}
Target Audience: ${topic.targetAudience}
Target Word Count: ${template.targetWordCount}

Template Structure to Follow:
${template.structure.map(section => `- ${section.replace('_', ' ')}`).join('\n')}

Content Requirements:
✅ EXACTLY ${template.targetWordCount} words (critical requirement)
✅ SEO-optimized with natural keyword integration
✅ Engaging, professional tone
✅ Actionable insights and practical advice
✅ Current industry trends and data
✅ Real-world examples and case studies
✅ Clear headings structure (H1, H2, H3)
✅ Bullet points and numbered lists for readability
✅ Call-to-action sections
✅ Internal linking opportunities

Format the response as clean HTML with:
- Proper heading hierarchy (h1, h2, h3)
- Bullet points and numbered lists
- Bold and italic text for emphasis
- Paragraph breaks for readability
- Blockquotes for important insights
- Code blocks where relevant

Write the complete blog post now:
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: contentPrompt }],
        temperature: 0.7,
        max_tokens: 16000
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating templated content:', error);
      return '';
    }
  }

  /**
   * Inject relevant images into content
   */
  private async injectRelevantImages(topic: BlogTopic, content: string): Promise<{content: string, imageData: any[]}> {
    try {
      // Generate GPT-optimized image keywords
      const imageKeywords = await this.generateImageKeywords(topic);
      
      // Fetch relevant images
      const images = await imageService.getRelevantImages(
        topic.title, 
        imageKeywords, 
        4 // Get 4 images for comprehensive coverage
      );

      if (images.length === 0) {
        return { content, imageData: [] };
      }

      // Inject images into content at strategic points
      const enhancedContent = imageService.injectImagesIntoContent(content, images);
      
      const imageData = images.map(img => ({
        url: img.url,
        alt: img.alt,
        attribution: img.attribution
      }));

      return { content: enhancedContent, imageData };
    } catch (error) {
      console.error('Error injecting images:', error);
      return { content, imageData: [] };
    }
  }

  /**
   * Generate optimal image keywords using GPT
   */
  private async generateImageKeywords(topic: BlogTopic): Promise<string[]> {
    const prompt = `
For this blog topic, suggest 6-8 specific image keywords that would be most visually compelling and relevant:

Topic: ${topic.title}
Target Keyword: ${topic.targetKeyword}
Content Angle: ${topic.contentAngle}
Target Audience: ${topic.targetAudience}

Image keywords should be:
- Professional and high-quality
- Relevant to the topic and audience
- Diverse (concepts, people, objects, abstract)
- Likely to find good stock photos
- Visually engaging and modern

Return as JSON: {"keywords": ["keyword1", "keyword2", ...]}
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
      console.error('Error generating image keywords:', error);
      return [topic.targetKeyword, 'business', 'professional', 'technology'];
    }
  }

  /**
   * Calculate word count from HTML content
   */
  private calculateWordCount(content: string): number {
    // Strip HTML tags and count words
    const textContent = content.replace(/<[^>]*>/g, ' ').trim();
    return textContent.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate estimated reading time
   */
  private calculateReadingTime(content: string): number {
    const wordCount = this.calculateWordCount(content);
    return Math.ceil(wordCount / 200); // 200 words per minute average
  }
}

// Type definitions
export interface BlogTemplate {
  name: string;
  description: string;
  structure: string[];
  targetWordCount: number;
  seoOptimized: boolean;
  useCase: string;
}

export interface BlogTopic {
  title: string;
  metaDescription: string;
  targetKeyword: string;
  seoKeywords?: string[];
  contentAngle?: string;
  targetAudience?: string;
  trendSource?: string;
  contentType?: string;
  difficulty?: string;
  businessImpact?: string;
}

export interface BlogPost {
  title: string;
  content: string;
  metaDescription: string;
  targetKeyword: string;
  wordCount: number;
  readingTime: number;
  images?: any[];
  seoKeywords?: string[];
  template?: string;
  createdAt: string;
}

export const blogTemplateEngine = new BlogTemplateEngine();