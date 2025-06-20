import OpenAI from "openai";
import { imageService } from "./image-service";
import { trendResearch, TrendInsight } from "./trend-research";

interface ContentChunk {
  title: string;
  section: string;
  targetWords: number;
  isIntroduction: boolean;
  isConclusion: boolean;
  order: number;
}

/**
 * Blog Template Engine - Chunked content generation for better quality
 * Updated to generate 1500-2000 text words (excluding HTML) using modular prompts
 */
export class BlogTemplateEngine {
  private openai: OpenAI;
  private templates: BlogTemplate[] = [];

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
   * Generate blog post using chunked template system
   */
  async generateBlogPost(topic: BlogTopic): Promise<BlogPost> {
    const template = this.selectOptimalTemplate(topic);
    console.log(`Using template: ${template.name} for topic: ${topic.title}`);

    // Generate content using chunked approach for better quality
    const content = await this.generateChunkedContent(topic, template);
    const textWordCount = this.calculateTextWordCount(content);
    
    console.log(`Generated blog post: ${textWordCount} text words (target: 1500-2000)`);
    
    // Auto-inject relevant images (with error handling)
    let images: { content: string; imageData: any[] };
    try {
      images = await this.injectRelevantImages(topic, content);
    } catch (error) {
      console.log('Image injection failed, using content without images:', error);
      images = { content, imageData: [] };
    }
    
    const finalTextWordCount = this.calculateTextWordCount(images.content);
    
    return {
      title: topic.title,
      content: images.content,
      metaDescription: topic.metaDescription,
      targetKeyword: topic.targetKeyword,
      wordCount: finalTextWordCount,
      readingTime: this.calculateReadingTime(images.content),
      images: images.imageData,
      seoKeywords: topic.seoKeywords,
      template: template.name,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Initialize blog templates with 1500-2000 word targets
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
        targetWordCount: 1800,
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
        targetWordCount: 1700,
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
        targetWordCount: 1800,
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
        targetWordCount: 1750,
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
        targetWordCount: 1900,
        seoOptimized: true,
        useCase: "business strategy, planning, execution"
      }
    ];
  }

  /**
   * Generate content using chunked approach for better quality
   */
  private async generateChunkedContent(topic: BlogTopic, template: BlogTemplate): Promise<string> {
    const chunks = this.createContentChunks(template.structure, topic);
    let fullContent = '';
    
    console.log(`Generating ${chunks.length} content chunks for ${topic.title}`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Generating chunk ${i + 1}/${chunks.length}: ${chunk.title}`);
      
      try {
        const chunkContent = await this.generateContentChunk(chunk, topic, template, fullContent);
        fullContent += chunkContent + '\n\n';
        
        // Brief pause between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error generating chunk ${chunk.title}:`, error);
        // Continue with next chunk rather than failing entirely
      }
    }
    
    return fullContent.trim();
  }

  /**
   * Create content chunks based on template structure
   */
  private createContentChunks(structure: string[], topic: BlogTopic): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const targetWordsPerChunk = Math.ceil(1750 / structure.length); // Target 1750 words total
    
    structure.forEach((section, index) => {
      chunks.push({
        title: this.humanizeSection(section),
        section: section,
        targetWords: targetWordsPerChunk,
        isIntroduction: index === 0,
        isConclusion: index === structure.length - 1,
        order: index + 1
      });
    });
    
    return chunks;
  }

  /**
   * Generate individual content chunk
   */
  private async generateContentChunk(
    chunk: ContentChunk, 
    topic: BlogTopic, 
    template: BlogTemplate, 
    previousContent: string
  ): Promise<string> {
    const contextualPrompt = this.buildChunkPrompt(chunk, topic, template, previousContent);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert content writer specializing in SEO-optimized blog content. 
          Generate high-quality, engaging content that provides real value to readers.
          Focus on actionable insights, specific examples, and authoritative information.
          Use HTML formatting with proper heading tags, lists, and paragraph structure.
          Target approximately ${chunk.targetWords} words for this section.`
        },
        {
          role: "user",
          content: contextualPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Build contextual prompt for content chunk
   */
  private buildChunkPrompt(
    chunk: ContentChunk, 
    topic: BlogTopic, 
    template: BlogTemplate, 
    previousContent: string
  ): string {
    const hasContext = previousContent.length > 0;
    const contextSection = hasContext ? `\n\nPrevious content context:\n${previousContent.slice(-500)}` : '';
    
    if (chunk.isIntroduction) {
      return `Generate an engaging introduction and first section for a blog titled "${topic.title}".

Target keyword: ${topic.targetKeyword}
Section focus: ${chunk.title}
Target length: ${chunk.targetWords} words

Requirements:
- Hook readers with a compelling opening
- Introduce the main topic and its importance
- Include the target keyword naturally
- Set up the structure for the rest of the article
- Use HTML formatting with <h1>, <h2>, <p>, <ul>/<ol> tags${contextSection}`;
    }
    
    if (chunk.isConclusion) {
      return `Generate a strong conclusion and call-to-action for the blog titled "${topic.title}".

Section focus: ${chunk.title}
Target length: ${chunk.targetWords} words
Target keyword: ${topic.targetKeyword}

Requirements:
- Summarize key points from the article
- Provide actionable next steps
- Include a compelling call-to-action
- End with authority and confidence
- Use HTML formatting${contextSection}`;
    }
    
    return `Continue the blog titled "${topic.title}" with a section focused on "${chunk.title}".

Target keyword: ${topic.targetKeyword}
Section focus: ${chunk.title}
Target length: ${chunk.targetWords} words

Requirements:
- Provide detailed, actionable information
- Include specific examples and best practices
- Use subheadings, bullet points, and clear structure
- Maintain consistency with previous content
- Focus on practical value for readers
- Use HTML formatting with <h2>, <h3>, <p>, <ul>/<ol> tags${contextSection}`;
  }

  /**
   * Calculate word count excluding HTML tags
   */
  private calculateTextWordCount(content: string): number {
    // Remove HTML tags and count words
    const textOnly = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.split(' ').filter(word => word.length > 0).length;
  }

  /**
   * Humanize section names for better readability
   */
  private humanizeSection(section: string): string {
    return section
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
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
3. Address pain points and interests shown in the trend data
4. Have strong SEO potential and search volume

For each topic, provide:
- title: Compelling, click-worthy headline
- targetKeyword: Primary SEO keyword from GSC data
- metaDescription: 150-160 character meta description
- seoKeywords: Array of 5-8 related keywords
- contentType: one of: guide, analysis, comparison, strategy, problem
- contentAngle: Unique angle or approach
- targetAudience: Primary audience segment

Return as JSON object with this exact format:
{
  "topics": [
    { "title": "...", "targetKeyword": "...", "metaDescription": "...", "seoKeywords": [...], "contentType": "...", "contentAngle": "...", "targetAudience": "..." }
  ]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert content strategist. Always return valid JSON arrays with the exact structure requested."
          },
          {
            role: "user",
            content: topicPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{"topics": []}');
      return result.topics || result || [];
    } catch (error) {
      console.error('Error generating blog topics:', error);
      return this.getFallbackTopics(industry, gscKeywords);
    }
  }

  /**
   * Select optimal template based on content type
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
   * Auto-inject relevant images into content
   */
  private async injectRelevantImages(topic: BlogTopic, content: string): Promise<{ content: string; imageData: any[] }> {
    try {
      // Generate relevant image keywords
      const imageKeywords = await this.generateImageKeywords(topic);
      
      if (imageKeywords.length === 0) {
        return { content, imageData: [] };
      }

      // Generate images for the article
      const images = await imageService.getRelevantImages(
        topic.title,
        imageKeywords
      );

      if (images && images.length > 0) {
        // Inject images into content at strategic points
        const contentWithImages = this.injectImagesIntoContent(content, images);
        return {
          content: contentWithImages,
          imageData: images.map((img: any) => ({
            url: img.url,
            alt: img.alt || `Illustration for ${topic.title}`,
            caption: img.caption || ''
          }))
        };
      }
    } catch (error) {
      console.log('Image generation failed:', error);
    }

    return { content, imageData: [] };
  }

  /**
   * Generate relevant image keywords for the topic
   */
  private async generateImageKeywords(topic: BlogTopic): Promise<string[]> {
    const prompt = `
Generate 3-5 specific image keywords for this blog topic:
Title: ${topic.title}
Keyword: ${topic.targetKeyword}
Audience: ${topic.targetAudience || 'Business professionals'}
Type: ${topic.contentType || 'guide'}

Return keywords that would make compelling, relevant illustrations.
Return as simple JSON array of strings.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Generate specific, relevant image keywords. Return only a JSON array of strings."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      return result.keywords || result || [];
    } catch (error) {
      console.error('Error generating image keywords:', error);
      return [topic.targetKeyword || topic.title];
    }
  }

  /**
   * Inject images into content at strategic points
   */
  private injectImagesIntoContent(content: string, images: any[]): string {
    const sections = content.split('<h2>');
    let modifiedContent = sections[0]; // Keep intro as-is
    
    for (let i = 1; i < sections.length && i - 1 < images.length; i++) {
      const image = images[i - 1];
      const imageHtml = `\n\n<div class="blog-image">
  <img src="${image.url}" alt="${image.alt || 'Blog illustration'}" loading="lazy" />
  ${image.caption ? `<figcaption>${image.caption}</figcaption>` : ''}
</div>\n\n`;
      
      modifiedContent += imageHtml + '<h2>' + sections[i];
    }
    
    return modifiedContent;
  }

  /**
   * Calculate reading time based on content
   */
  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.calculateTextWordCount(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Fallback topics when AI generation fails
   */
  private getFallbackTopics(industry: string, gscKeywords: any[]): BlogTopic[] {
    const topKeyword = gscKeywords[0]?.keyword || `${industry} trends`;
    
    return [
      {
        title: `Ultimate Guide to ${industry} in 2025`,
        targetKeyword: topKeyword,
        metaDescription: `Comprehensive guide covering the latest ${industry} trends, best practices, and strategies for success in 2025.`,
        seoKeywords: [topKeyword, `${industry} guide`, `${industry} best practices`],
        contentType: 'guide',
        contentAngle: 'Comprehensive overview with actionable insights',
        targetAudience: 'Business professionals and industry practitioners'
      }
    ];
  }
}

// Export interfaces for external use
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
  targetKeyword: string;
  metaDescription: string;
  seoKeywords: string[];
  contentType: string;
  contentAngle: string;
  targetAudience: string;
  secondaryKeywords?: string[];
  searchVolume?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  wordCount?: string;
  outline?: string[];
  seoGoal?: string;
  estimatedRankingPotential?: string;
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

export const blogTemplateEngine = new BlogTemplateEngine();