import OpenAI from "openai";
import { SEOIssueType, AuditResultsType } from '@shared/schema';

export class IssueResolverService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateIssueResolutions(auditResults: AuditResultsType): Promise<{
    criticalResolutions: ResolutionPlan[];
    mediumResolutions: ResolutionPlan[];
    quickWins: ResolutionPlan[];
  }> {
    const criticalIssues = auditResults.issues.filter(i => i.severity === 'critical');
    const mediumIssues = auditResults.issues.filter(i => i.severity === 'medium');
    
    const [criticalResolutions, mediumResolutions, quickWins] = await Promise.all([
      this.generateResolutionsForIssues(criticalIssues, 'critical', auditResults),
      this.generateResolutionsForIssues(mediumIssues.slice(0, 10), 'medium', auditResults),
      this.generateQuickWinActions(auditResults)
    ]);

    return {
      criticalResolutions,
      mediumResolutions,
      quickWins
    };
  }

  private async generateResolutionsForIssues(
    issues: SEOIssueType[],
    severity: 'critical' | 'medium',
    auditResults: AuditResultsType
  ): Promise<ResolutionPlan[]> {
    if (issues.length === 0) return [];

    const prompt = `
You are an expert SEO consultant. Analyze these ${severity} SEO issues for ${auditResults.url} and provide specific, actionable resolution plans.

Website Context:
- Industry: ${auditResults.industry}
- Current SEO Score: ${auditResults.stats.seoScore}/100
- Top performing query: ${auditResults.gscData?.topQueries[0]?.query || 'N/A'}
- Average position: ${auditResults.gscData?.avgPosition || 'N/A'}

Issues to resolve:
${issues.map((issue, i) => `${i + 1}. ${issue.type}: ${issue.message}${issue.page ? ` (Page: ${issue.page})` : ''}`).join('\n')}

For each issue, provide a JSON response with this structure:
{
  "resolutions": [
    {
      "issueType": "string",
      "pageUrl": "the specific webpage URL where this issue occurs",
      "priority": "high|medium|low",
      "timeToComplete": "string (e.g., '2 hours', '1 day')",
      "difficulty": "easy|medium|hard",
      "impact": "high|medium|low",
      "actionPlan": {
        "overview": "Brief description of what needs to be done",
        "steps": ["Step 1", "Step 2", "Step 3"],
        "technicalDetails": "Specific technical implementation details",
        "codeExample": "HTML/CSS code snippet, content template, or implementation example",
        "testingInstructions": "How to verify the fix worked"
      },
      "expectedOutcome": "What improvement this will bring",
      "tools": ["List of tools/resources needed"],
      "dependencies": ["Any prerequisites or dependencies"]
    }
  ]
}

Focus on practical, implementable solutions that will have the biggest SEO impact.

For content-related issues (thin content, missing content), provide content templates or HTML structure examples.
For technical issues (meta tags, schema), provide actual HTML/CSS code snippets.
For internal linking issues, provide anchor text and link examples.
Never use "NA" or "Not applicable" - always provide a relevant example or template.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert SEO consultant providing actionable resolution plans. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{"resolutions": []}');
      const resolutions = result.resolutions || [];
      
      // Ensure all resolutions have proper code examples and page URLs
      return resolutions.map((resolution: any, index: number) => {
        const matchingIssue = issues[index];
        return {
          ...resolution,
          pageUrl: matchingIssue?.page || resolution.pageUrl || auditResults.url,
          actionPlan: {
            ...resolution.actionPlan,
            codeExample: this.ensureCodeExample(resolution.issueType, resolution.actionPlan?.codeExample)
          }
        };
      });
    } catch (error) {
      console.error('Error generating issue resolutions:', error);
      return [];
    }
  }

  private ensureCodeExample(issueType: string, existingExample?: string): string {
    if (existingExample && existingExample !== 'NA' && existingExample !== 'Not applicable') {
      return existingExample;
    }

    // Provide fallback code examples based on issue type
    switch (issueType?.toLowerCase()) {
      case 'thin content':
        return `<!-- Content expansion template -->
<section class="content-expansion">
  <h2>Key Benefits</h2>
  <ul>
    <li>Benefit 1 with detailed explanation</li>
    <li>Benefit 2 with supporting details</li>
    <li>Benefit 3 with real-world examples</li>
  </ul>
  
  <h2>Frequently Asked Questions</h2>
  <div class="faq-item">
    <h3>Question 1?</h3>
    <p>Detailed answer that adds value...</p>
  </div>
</section>`;

      case 'missing meta description':
        return `<meta name="description" content="Compelling 150-160 character description with primary keyword and call-to-action">`;

      case 'missing title tag':
        return `<title>Primary Keyword | Secondary Keyword | Brand Name</title>`;

      case 'missing internal links':
        return `<a href="/related-page" title="Descriptive anchor text">
  Strategic internal link with keyword-rich anchor text
</a>`;

      case 'missing schema markup':
        return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com"
}
</script>`;

      default:
        return `<!-- Implementation example -->
<div class="seo-improvement">
  <!-- Add relevant HTML structure or content template here -->
  <p>Implementation steps and code examples...</p>
</div>`;
    }
  }

  private async generateQuickWinActions(auditResults: AuditResultsType): Promise<ResolutionPlan[]> {
    const prompt = `
Analyze this SEO audit data for ${auditResults.url} and identify 5-7 quick win opportunities that can be implemented within 1-2 hours each.

Current Performance:
- SEO Score: ${auditResults.stats.seoScore}/100
- Total clicks: ${auditResults.gscData?.totalClicks || 0}
- Total impressions: ${auditResults.gscData?.totalImpressions || 0}
- CTR: ${auditResults.gscData?.avgCTR || 0}%

Top Queries:
${auditResults.gscData?.topQueries?.slice(0, 5).map(q => `- "${q.query}" (Position: ${q.position.toFixed(1)}, CTR: ${q.ctr.toFixed(2)}%)`).join('\n') || 'No query data available'}

Provide quick win recommendations as JSON:
{
  "resolutions": [
    {
      "issueType": "Quick Win - [Category]",
      "pageUrl": "specific page URL where this optimization applies",
      "priority": "high",
      "timeToComplete": "30 minutes - 2 hours",
      "difficulty": "easy",
      "impact": "medium|high",
      "actionPlan": {
        "overview": "What to do",
        "steps": ["Specific actionable steps"],
        "technicalDetails": "Implementation details",
        "codeExample": "Example if needed",
        "testingInstructions": "How to verify"
      },
      "expectedOutcome": "Expected improvement",
      "tools": ["Tools needed"],
      "dependencies": []
    }
  ]
}

Focus on:
1. Meta title/description optimizations
2. Schema markup additions
3. Internal linking improvements
4. Image optimization
5. Page speed quick fixes
6. Content optimization for better keyword targeting
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an SEO expert identifying quick win opportunities. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      const result = JSON.parse(response.choices[0].message.content || '{"resolutions": []}');
      const resolutions = result.resolutions || [];
      
      // Ensure all quick wins have page URLs
      return resolutions.map((resolution: any) => ({
        ...resolution,
        pageUrl: resolution.pageUrl || auditResults.url
      }));
    } catch (error) {
      console.error('Error generating quick wins:', error);
      return [];
    }
  }

  async generateContentOptimizations(auditResults: AuditResultsType): Promise<ContentOptimization[]> {
    const topQueries = auditResults.gscData?.topQueries?.slice(0, 10) || [];
    
    const prompt = `
Based on this SEO audit data for ${auditResults.url}, provide content optimization recommendations.

Current Performance Data:
- Industry: ${auditResults.industry}
- SEO Score: ${auditResults.stats.seoScore}/100
- Average Position: ${auditResults.gscData?.avgPosition || 'N/A'}

Top Search Queries & Performance:
${topQueries.map(q => `- "${q.query}": Position ${q.position.toFixed(1)}, CTR ${q.ctr.toFixed(2)}%, ${q.clicks} clicks`).join('\n')}

Provide content optimization recommendations as JSON:
{
  "optimizations": [
    {
      "contentType": "landing_page|blog_post|product_page|category_page",
      "targetKeyword": "primary keyword to target",
      "currentPosition": number,
      "targetPosition": number,
      "recommendations": {
        "titleOptimization": "Optimized title suggestion",
        "metaDescription": "Optimized meta description",
        "contentStructure": ["H1", "H2 suggestions", "Content sections"],
        "keywordDensity": "Target density and placement",
        "internalLinks": ["Suggested internal link opportunities"],
        "relatedKeywords": ["LSI keywords to include"]
      },
      "estimatedImpact": "high|medium|low",
      "implementationEffort": "low|medium|high"
    }
  ]
}

Focus on queries where position is 4-20 (biggest opportunity for ranking improvements).
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an SEO content strategist. Provide actionable content optimization recommendations in valid JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{"optimizations": []}');
      return result.optimizations || [];
    } catch (error) {
      console.error('Error generating content optimizations:', error);
      return [];
    }
  }
}

export interface ResolutionPlan {
  issueType: string;
  priority: 'high' | 'medium' | 'low';
  timeToComplete: string;
  difficulty: 'easy' | 'medium' | 'hard';
  impact: 'high' | 'medium' | 'low';
  actionPlan: {
    overview: string;
    steps: string[];
    technicalDetails: string;
    codeExample?: string;
    testingInstructions: string;
  };
  expectedOutcome: string;
  tools: string[];
  dependencies: string[];
}

export interface ContentOptimization {
  contentType: string;
  targetKeyword: string;
  currentPosition: number;
  targetPosition: number;
  recommendations: {
    titleOptimization: string;
    metaDescription: string;
    contentStructure: string[];
    keywordDensity: string;
    internalLinks: string[];
    relatedKeywords: string[];
  };
  estimatedImpact: 'high' | 'medium' | 'low';
  implementationEffort: 'low' | 'medium' | 'high';
}