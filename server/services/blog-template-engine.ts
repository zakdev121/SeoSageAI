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

    // Generate content using the selected template with enforced word count
    let content = await this.generateTemplatedContent(topic, template);
    let wordCount = this.calculateWordCount(content);
    
    console.log(`Initial content generated: ${wordCount} words (target: ${template.targetWordCount})`);
    
    // Enforce 2,000-word minimum with iterative expansion
    let attempts = 0;
    const maxAttempts = 3;
    
    while (wordCount < template.targetWordCount * 0.9 && attempts < maxAttempts) {
      console.log(`Content too short (${wordCount} words), expanding... (attempt ${attempts + 1}/${maxAttempts})`);
      const additionalWords = template.targetWordCount - wordCount;
      content = await this.expandContent(content, topic, template, additionalWords);
      wordCount = this.calculateWordCount(content);
      attempts++;
    }
    
    console.log(`Final content: ${wordCount} words after ${attempts} expansion attempts`);
    
    // Auto-inject relevant images (with error handling)
    let images: { content: string; imageData: any[] };
    try {
      images = await this.injectRelevantImages(topic, content);
    } catch (error) {
      console.log('Image injection failed, using content without images:', error);
      images = { content, imageData: [] };
    }
    
    const finalWordCount = this.calculateWordCount(images.content);
    
    return {
      title: topic.title,
      content: images.content,
      metaDescription: topic.metaDescription,
      targetKeyword: topic.targetKeyword,
      wordCount: finalWordCount,
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
        targetWordCount: 2000,
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
        targetWordCount: 2000,
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
        targetWordCount: 2000,
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
        targetWordCount: 2000,
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
        targetWordCount: 2000,
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
You are an expert content writer creating a comprehensive, SEO-optimized blog post. This must be a complete, professional article of EXACTLY ${template.targetWordCount} words.

ARTICLE DETAILS:
- Topic: ${topic.title}
- Primary Keyword: ${topic.targetKeyword}
- SEO Keywords: ${topic.seoKeywords?.join(', ') || ''}
- Content Angle: ${topic.contentAngle || 'Comprehensive guide'}
- Target Audience: ${topic.targetAudience || 'Business professionals'}
- Template: ${template.name}

MANDATORY STRUCTURE (follow this exact flow):
${template.structure.map((section, index) => `${index + 1}. ${section.replace(/_/g, ' ').toUpperCase()}`).join('\n')}

CRITICAL REQUIREMENTS:
🎯 WORD COUNT: Must be EXACTLY ${template.targetWordCount} words of readable content
📝 DEPTH: Each section must be 300-500 words with detailed explanations
🔗 SEO: Natural integration of keywords throughout all sections
📊 DATA: Include statistics, research findings, and current industry data
💡 EXAMPLES: Provide real-world case studies and practical examples
🎨 FORMATTING: Professional HTML with proper heading hierarchy

CONTENT DEPTH REQUIREMENTS:
- Introduction: 200-300 words setting context and value proposition
- Each main section: 400-600 words with deep analysis
- Examples/case studies: Specific, detailed scenarios with outcomes
- Actionable advice: Step-by-step instructions and best practices
- Current trends: Recent developments and industry insights
- Conclusion: 200-300 words summarizing key takeaways

HTML STRUCTURE:
<h1>${topic.title}</h1>
<p>Compelling introduction paragraph...</p>

<h2>Section Title</h2>
<p>Detailed content with <strong>emphasis</strong> and <em>italics</em>...</p>
<ul>
<li>Bullet point with detail</li>
<li>Another comprehensive point</li>
</ul>

<h3>Subsection</h3>
<p>More detailed content...</p>

<blockquote>
"Important insight or quote"
</blockquote>

Continue this pattern for ALL ${template.structure.length} sections.

WRITE THE COMPLETE ${template.targetWordCount}-WORD BLOG POST NOW:
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional content writer who ALWAYS writes exactly ${template.targetWordCount} words. Count carefully and ensure comprehensive coverage of all topics.`
          },
          {
            role: "user", 
            content: contentPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused, detailed content
        max_tokens: 16000
      });

      let content = response.choices[0].message.content || '';
      
      // Validate and enforce word count
      const wordCount = this.calculateWordCount(content);
      console.log(`Generated blog post: ${wordCount} words (target: ${template.targetWordCount})`);
      
      // If content is too short, generate additional sections
      if (wordCount < template.targetWordCount * 0.8) {
        console.log(`Content too short (${wordCount} words), expanding...`);
        content = await this.expandContent(content, topic, template, template.targetWordCount - wordCount);
      }
      
      return content;
    } catch (error) {
      console.error('Error generating templated content:', error);
      return '';
    }
  }

  /**
   * Expand content to meet word count requirements
   */
  private async expandContent(currentContent: string, topic: BlogTopic, template: BlogTemplate, additionalWords: number): Promise<string> {
    const expansionPrompt = `
You are expanding an existing blog post to meet the required ${template.targetWordCount} word count. The current content is ${this.calculateWordCount(currentContent)} words and needs ${additionalWords} more words.

CURRENT CONTENT:
${currentContent}

EXPANSION REQUIREMENTS:
- Add exactly ${additionalWords} more words of high-quality content
- Maintain the existing structure and flow
- Add new sections like:
  * "Advanced Strategies"
  * "Common Mistakes to Avoid" 
  * "Real-World Case Studies"
  * "Future Trends and Predictions"
  * "Implementation Checklist"
  * "Frequently Asked Questions"
- Include more detailed examples and explanations
- Add statistical data and research findings
- Provide actionable tips and best practices

Return the COMPLETE expanded blog post with the original content plus new sections:
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are expanding blog content to reach exactly the target word count while maintaining quality and relevance."
          },
          {
            role: "user",
            content: expansionPrompt
          }
        ],
        temperature: 0.4,
        max_tokens: 16000
      });

      const expandedContent = response.choices[0].message.content || currentContent;
      const finalWordCount = this.calculateWordCount(expandedContent);
      console.log(`Content expanded from ${this.calculateWordCount(currentContent)} to ${finalWordCount} words`);
      
      return expandedContent;
    } catch (error) {
      console.error('Error expanding content:', error);
      return currentContent;
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