import OpenAI from "openai";
import { AIRecommendationType, PageDataType, KeywordOpportunityType } from '@shared/schema';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
    });
  }

  async generateRecommendations(
    pages: PageDataType[],
    opportunities: KeywordOpportunityType[],
    industry: string
  ): Promise<AIRecommendationType[]> {
    try {
      const prompt = `
        Analyze the following website data and generate SEO recommendations:
        
        Industry: ${industry}
        
        Pages analyzed: ${pages.length}
        Pages data: ${JSON.stringify(pages.map(p => ({
          url: p.url,
          title: p.title,
          metaDescription: p.metaDescription,
          h1Count: p.h1.length,
          h2Count: p.h2.length,
          wordCount: p.wordCount,
          missingAlt: p.images.filter(img => !img.alt).length
        })), null, 2)}
        
        Keyword opportunities: ${JSON.stringify(opportunities.slice(0, 10), null, 2)}
        
        Generate specific, actionable recommendations in JSON format with this structure:
        {
          "recommendations": [
            {
              "type": "blog|faq|meta|content",
              "title": "specific recommendation title",
              "description": "detailed description",
              "targetKeyword": "optional target keyword",
              "priority": "high|medium|low",
              "content": "optional specific content suggestion"
            }
          ]
        }
        
        Focus on:
        1. Blog post ideas targeting opportunity keywords
        2. FAQ sections with schema markup opportunities
        3. Meta description rewrites for pages missing them
        4. Content improvements for thin pages
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      const recommendations = result.recommendations || [];
      
      // Ensure content field is always a string
      return recommendations.map((rec: any) => ({
        ...rec,
        content: Array.isArray(rec.content) ? rec.content.join('\n') : rec.content
      }));
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return this.getFallbackRecommendations(pages, opportunities, industry);
    }
  }

  async generateMetaDescriptions(pages: PageDataType[]): Promise<Record<string, string>> {
    const metaDescriptions: Record<string, string> = {};
    
    for (const page of pages) {
      if (!page.metaDescription && page.title) {
        try {
          const prompt = `
            Generate a compelling meta description for this page:
            
            Title: ${page.title}
            URL: ${page.url}
            H1 tags: ${page.h1.join(', ')}
            H2 tags: ${page.h2.slice(0, 3).join(', ')}
            
            Requirements:
            - 150-160 characters
            - Include primary keyword from title
            - Action-oriented
            - Describe value proposition
            
            Return only the meta description text, no additional formatting.
          `;

          const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5
          });

          const metaDescription = response.choices[0].message.content?.trim();
          if (metaDescription && metaDescription.length <= 160) {
            metaDescriptions[page.url] = metaDescription;
          }
        } catch (error) {
          console.error(`Error generating meta description for ${page.url}:`, error);
        }
      }
    }

    return metaDescriptions;
  }

  async generateBlogTopics(
    opportunities: KeywordOpportunityType[],
    industry: string
  ): Promise<Array<{ title: string; keyword: string; description: string }>> {
    try {
      const topKeywords = opportunities.slice(0, 5).map(k => k.keyword).join(', ');
      
      const prompt = `
        Generate 10 blog post ideas for a ${industry} company targeting these keywords: ${topKeywords}
        
        Return JSON format:
        {
          "topics": [
            {
              "title": "compelling blog post title",
              "keyword": "primary target keyword",
              "description": "brief description of the post content"
            }
          ]
        }
        
        Focus on educational, helpful content that would rank well and attract the target audience.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.8
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.topics || [];
    } catch (error) {
      console.error('Error generating blog topics:', error);
      return [];
    }
  }

  private getFallbackRecommendations(
    pages: PageDataType[],
    opportunities: KeywordOpportunityType[],
    industry: string
  ): AIRecommendationType[] {
    const recommendations: AIRecommendationType[] = [];

    // Add meta description recommendations for pages missing them
    pages.forEach(page => {
      if (!page.metaDescription) {
        recommendations.push({
          type: 'meta',
          title: `Add meta description to ${page.url}`,
          description: 'This page is missing a meta description, which is important for search engine rankings and click-through rates.',
          priority: 'high'
        });
      }
    });

    // Add blog recommendations based on keyword opportunities
    if (opportunities.length > 0) {
      recommendations.push({
        type: 'blog',
        title: `Create content targeting "${opportunities[0].keyword}"`,
        description: `This keyword has ${opportunities[0].impressions} impressions but is ranking at position ${opportunities[0].position}. Creating targeted content could improve rankings.`,
        targetKeyword: opportunities[0].keyword,
        priority: 'high'
      });
    }

    // Add FAQ recommendation
    recommendations.push({
      type: 'faq',
      title: 'Add FAQ section with schema markup',
      description: `Create an FAQ section targeting common questions in the ${industry} industry to capture featured snippets.`,
      priority: 'medium'
    });

    return recommendations;
  }
}
