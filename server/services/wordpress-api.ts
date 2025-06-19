import axios from 'axios';
import { htmlIntegrityService, HTMLIntegrityReport } from './html-integrity';

export interface WordPressPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  yoast_head?: string;
  yoast_head_json?: {
    title?: string;
    description?: string;
    canonical?: string;
    og_title?: string;
    og_description?: string;
  };
}

export interface SEOFix {
  type: 'meta_description' | 'title_tag' | 'alt_text' | 'schema' | 'internal_links' | 'title_optimization' | 'content_expansion';
  postId: number;
  currentValue: string;
  newValue: string;
  description: string;
}

export class WordPressService {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(siteUrl: string) {
    this.baseUrl = `${siteUrl}/wp-json/wp/v2`;
    this.username = process.env.WP_USERNAME || '';
    this.password = process.env.WP_APP_PASSWORD || '';
  }

  private getAuthHeaders() {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    console.log(`Using WordPress credentials: ${this.username} (length: ${this.password.length})`);
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/posts?per_page=1`, {
        headers: this.getAuthHeaders()
      });
      
      // Check if response is actually JSON, not PHP code
      const contentType = response.headers['content-type'] || '';
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      // If response contains PHP code or isn't valid JSON, the API is broken
      if (responseText.includes('<?php') || responseText.includes('function ') || !contentType.includes('json')) {
        console.log('WordPress REST API returning PHP code instead of JSON - API is broken');
        return false;
      }
      
      return response.status === 200 && Array.isArray(response.data);
    } catch (error) {
      console.error('WordPress connection test failed:', error);
      return false;
    }
  }

  async getAllPosts(): Promise<WordPressPost[]> {
    try {
      const allPosts: WordPressPost[] = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 10; // Safety limit to prevent infinite loops

      while (hasMore && page <= maxPages) {
        const response = await axios.get(`${this.baseUrl}/posts`, {
          headers: this.getAuthHeaders(),
          params: {
            per_page: 100,
            page: page,
            status: 'publish'
          }
        });

        const posts = response.data;
        if (!Array.isArray(posts) || posts.length === 0) {
          break;
        }
        
        allPosts.push(...posts);
        hasMore = posts.length === 100;
        page++;
      }

      return allPosts;
    } catch (error) {
      console.error('Error fetching WordPress posts:', error);
      return [];
    }
  }

  async getAllPages(): Promise<WordPressPost[]> {
    try {
      const allPages: WordPressPost[] = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 10; // Safety limit to prevent infinite loops

      while (hasMore && page <= maxPages) {
        const response = await axios.get(`${this.baseUrl}/pages`, {
          headers: this.getAuthHeaders(),
          params: {
            per_page: 100,
            page: page,
            status: 'publish'
          }
        });

        const pages = response.data;
        if (!Array.isArray(pages) || pages.length === 0) {
          break;
        }
        
        allPages.push(...pages);
        hasMore = pages.length === 100;
        page++;
      }

      return allPages;
    } catch (error) {
      console.error('Error fetching WordPress pages:', error);
      return [];
    }
  }

  async getAllContent(): Promise<{ posts: WordPressPost[]; pages: WordPressPost[]; totalContent: number }> {
    try {
      const [posts, pages] = await Promise.all([
        this.getAllPosts(),
        this.getAllPages()
      ]);
      
      return {
        posts,
        pages,
        totalContent: posts.length + pages.length
      };
    } catch (error) {
      console.error('Error fetching all content:', error);
      return { posts: [], pages: [], totalContent: 0 };
    }
  }

  async getContentAsPageData(): Promise<any[]> {
    try {
      const { posts, pages } = await this.getAllContent();
      const allContent = [...posts, ...pages];
      
      return allContent.map(content => ({
        url: content.link || `${this.baseUrl.replace('/wp-json/wp/v2', '')}/${content.slug}`,
        title: content.title?.rendered || '',
        metaDescription: content.excerpt?.rendered?.replace(/<[^>]*>/g, '').trim() || '',
        h1: [content.title?.rendered || ''],
        h2: this.extractHeadings(content.content?.rendered || '', 'h2'),
        wordCount: this.countWords(content.content?.rendered || ''),
        images: this.extractImages(content.content?.rendered || ''),
        internalLinks: this.extractInternalLinks(content.content?.rendered || ''),
        externalLinks: this.extractExternalLinks(content.content?.rendered || ''),
        brokenLinks: [] // Would need additional checking
      }));
    } catch (error) {
      console.error('Error converting WordPress content to page data:', error);
      return [];
    }
  }

  private extractHeadings(content: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gi');
    const matches = content.match(regex) || [];
    return matches.map(match => match.replace(/<[^>]*>/g, '').trim());
  }

  private countWords(content: string): number {
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private extractImages(content: string): any[] {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi;
    const images: any[] = [];
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      images.push({
        src: match[1],
        alt: match[2] || '',
        size: undefined
      });
    }
    
    return images;
  }

  private extractInternalLinks(content: string): string[] {
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>/gi;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1];
      if (href.includes(this.baseUrl.replace('/wp-json/wp/v2', '')) || href.startsWith('/')) {
        links.push(href);
      }
    }
    
    return links;
  }

  private extractExternalLinks(content: string): string[] {
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>/gi;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1];
      if (href.startsWith('http') && !href.includes(this.baseUrl.replace('/wp-json/wp/v2', ''))) {
        links.push(href);
      }
    }
    
    return links;
  }

  async updatePostMetaDescription(postId: number, metaDescription: string): Promise<{
    success: boolean;
    message: string;
    integrityReport?: any;
    rollbackPerformed?: boolean;
  }> {
    let pageUrl = '';
    let beforeReport: HTMLIntegrityReport | null = null;
    
    try {
      // Get the post URL first
      const postResponse = await axios.get(`${this.baseUrl}/posts/${postId}`, {
        headers: this.getAuthHeaders()
      });
      pageUrl = postResponse.data.link || postResponse.data.guid?.rendered || `${this.baseUrl.replace('/wp-json/wp/v2', '')}/?p=${postId}`;
      
      // Check HTML integrity BEFORE making changes
      console.log(`🔍 Checking HTML integrity before update: ${pageUrl}`);
      beforeReport = await htmlIntegrityService.checkPageIntegrity(pageUrl);
      
      if (!beforeReport.isValid) {
        return {
          success: false,
          message: `Critical page detected: HTML structure is already compromised. Cannot safely update without risking further damage. Errors: ${beforeReport.criticalErrors.join(', ')}`,
          integrityReport: beforeReport
        };
      }

      // Apply the meta description update
      console.log(`Updating meta description for post ${postId}`);
      const updateResponse = await axios.post(
        `${this.baseUrl.replace('/wp/v2', '')}/synviz/v1/update-meta`,
        {
          post_id: postId,
          meta_description: metaDescription
        },
        { headers: this.getAuthHeaders() }
      );

      if (!updateResponse.data?.success) {
        return {
          success: false,
          message: 'Failed to apply meta description update'
        };
      }

      // Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check HTML integrity AFTER making changes  
      console.log(`🔍 Checking HTML integrity after update: ${pageUrl}`);
      const afterReport = await htmlIntegrityService.checkPageIntegrity(pageUrl);

      // Compare integrity reports
      const comparison = await htmlIntegrityService.compareIntegrity(beforeReport, afterReport);

      if (!comparison.integrityMaintained || comparison.newErrors.length > 0) {
        console.error(`❌ HTML integrity compromised! New errors: ${comparison.newErrors.join(', ')}`);
        
        // Attempt automatic rollback
        console.log(`🔄 Attempting automatic rollback for post ${postId}`);
        const rollbackSuccess = await this.rollbackMetaChanges(postId);
        
        return {
          success: false,
          message: `Critical page update failed: HTML structure was compromised after applying meta description. ${rollbackSuccess ? 'Automatic rollback completed.' : 'Rollback failed - manual intervention required.'} New errors detected: ${comparison.newErrors.join(', ')}`,
          integrityReport: { before: beforeReport, after: afterReport, comparison },
          rollbackPerformed: rollbackSuccess
        };
      }

      // Success - integrity maintained
      console.log(`✅ Meta description updated successfully with HTML integrity maintained`);
      return {
        success: true,
        message: 'Meta description updated successfully with HTML integrity verified',
        integrityReport: { before: beforeReport, after: afterReport, comparison }
      };

    } catch (error: any) {
      console.error(`Error in safe meta description update:`, error);
      
      // If we have reports, attempt rollback
      if (beforeReport && pageUrl) {
        console.log(`🔄 Error occurred, attempting rollback for post ${postId}`);
        const rollbackSuccess = await this.rollbackMetaChanges(postId);
        
        return {
          success: false,
          message: `Update failed due to error: ${error.message}. ${rollbackSuccess ? 'Automatic rollback completed.' : 'Rollback failed - manual intervention required.'}`,
          rollbackPerformed: rollbackSuccess
        };
      }

      return {
        success: false,
        message: `Failed to update meta description: ${error.message}`
      };
    }
  }

  private async rollbackMetaChanges(postId: number): Promise<boolean> {
    try {
      // Remove the meta description by setting it to empty
      const rollbackResponse = await axios.post(
        `${this.baseUrl.replace('/wp/v2', '')}/synviz/v1/update-meta`,
        {
          post_id: postId,
          meta_description: ''
        },
        { headers: this.getAuthHeaders() }
      );
      
      if (rollbackResponse.data?.success) {
        console.log(`✅ Rollback successful for post ${postId}`);
        return true;
      } else {
        console.error(`❌ Rollback failed for post ${postId}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Rollback error for post ${postId}:`, error);
      return false;
    }
  }

  async applyComprehensiveSEOFix(postId: number, updates: {
    title?: string;
    metaDescription?: string;
    focusKeyword?: string;
    content?: string;
  }): Promise<boolean> {
    try {
      console.log(`Applying comprehensive SEO fixes to post ${postId}`);
      
      const updatePayload: any = {
        post_id: postId,
        update: {}
      };

      if (updates.title) {
        updatePayload.update.title = updates.title;
      }

      if (updates.content) {
        updatePayload.update.content = updates.content;
      }

      const metaUpdates: any = {};
      if (updates.metaDescription) {
        metaUpdates._yoast_wpseo_metadesc = updates.metaDescription;
      }
      if (updates.focusKeyword) {
        metaUpdates._yoast_wpseo_focuskw = updates.focusKeyword;
      }
      if (updates.title) {
        metaUpdates._yoast_wpseo_title = updates.title;
      }

      if (Object.keys(metaUpdates).length > 0) {
        updatePayload.update.meta = metaUpdates;
      }

      const response = await axios.post(
        `${this.baseUrl.replace('/wp/v2', '')}/synviz/v1/update-meta`,
        updatePayload,
        { headers: this.getAuthHeaders() }
      );

      console.log(`✓ Comprehensive SEO fixes applied:`, response.data);
      return true;
      
    } catch (error: any) {
      console.error(`Comprehensive SEO fix failed for post ${postId}:`, error.response?.data?.message || error.message);
      return false;
    }
  }

  async updatePostTitle(postId: number, title: string): Promise<boolean> {
    try {
      // Use custom plugin endpoint for title optimization
      const response = await axios.post(
        `${this.baseUrl.replace('/wp-json/wp/v2', '')}/wp-json/synviz/v1/optimize-title`,
        {
          post_id: postId,
          optimized_title: title
        },
        { headers: this.getAuthHeaders() }
      );

      return response.data?.success === true;
    } catch (error) {
      console.error('Error updating post title:', error);
      return false;
    }
  }

  async addSchemaMarkup(postId: number, schemaJson: object): Promise<boolean> {
    try {
      // Get current post content
      const postResponse = await axios.get(`${this.baseUrl}/posts/${postId}`, {
        headers: this.getAuthHeaders()
      });

      const currentContent = postResponse.data.content.rendered;
      const schemaScript = `\n<script type="application/ld+json">\n${JSON.stringify(schemaJson, null, 2)}\n</script>`;
      
      // Add schema to post content
      const updatedContent = currentContent + schemaScript;

      const response = await axios.post(
        `${this.baseUrl}/posts/${postId}`,
        {
          content: updatedContent
        },
        { headers: this.getAuthHeaders() }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error adding schema markup:', error);
      return false;
    }
  }

  async updateImageAltText(postId: number, altTextUpdates: string): Promise<boolean> {
    try {
      // Use custom plugin endpoint for alt text updates
      const response = await axios.post(
        `${this.baseUrl.replace('/wp-json/wp/v2', '')}/wp-json/synviz/v1/update-alt-text`,
        {
          post_id: postId,
          image_updates: JSON.parse(altTextUpdates)
        },
        { headers: this.getAuthHeaders() }
      );

      return response.data?.success === true;
    } catch (error) {
      console.error('Error updating image alt text:', error);
      return false;
    }
  }

  async addInternalLinks(postId: number, links: Array<{anchor: string, url: string}>): Promise<boolean> {
    try {
      // Get current post content
      const postResponse = await axios.get(`${this.baseUrl}/posts/${postId}`, {
        headers: this.getAuthHeaders()
      });

      let content = postResponse.data.content.rendered;

      // Add internal links to content
      links.forEach(link => {
        const linkHtml = `<a href="${link.url}">${link.anchor}</a>`;
        // Replace first occurrence of anchor text with link
        content = content.replace(new RegExp(`\\b${link.anchor}\\b`, 'i'), linkHtml);
      });

      const response = await axios.post(
        `${this.baseUrl}/posts/${postId}`,
        {
          content: content
        },
        { headers: this.getAuthHeaders() }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error adding internal links:', error);
      return false;
    }
  }

  async expandPostContent(postId: number, additionalContent: string): Promise<boolean> {
    try {
      // Use custom plugin endpoint for content expansion
      const response = await axios.post(
        `${this.baseUrl.replace('/wp-json/wp/v2', '')}/wp-json/synviz/v1/expand-content`,
        {
          post_id: postId,
          additional_content: additionalContent
        },
        { headers: this.getAuthHeaders() }
      );

      return response.data?.success === true;
    } catch (error) {
      console.error('Error expanding post content:', error);
      return false;
    }
  }

  async applySEOFix(fix: SEOFix): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Applying SEO fix:', fix.type, 'for post ID:', fix.postId);
      
      // If postId is 0 or invalid, get the latest post to apply the fix
      let targetPostId = fix.postId;
      if (targetPostId === 0 || !targetPostId) {
        const posts = await this.getAllPosts();
        if (posts.length === 0) {
          return {
            success: false,
            message: 'No posts found to apply SEO fix'
          };
        }
        targetPostId = posts[0].id;
      }

      let success = false;
      let message = '';

      switch (fix.type) {
        case 'meta_description':
          const metaResult = await this.updatePostMetaDescription(targetPostId, fix.newValue);
          success = metaResult.success;
          message = metaResult.message;
          if (metaResult.rollbackPerformed) {
            message += ' (Automatic rollback was performed due to HTML integrity issues)';
          }
          break;

        case 'title_tag':
          success = await this.updatePostTitle(targetPostId, fix.newValue);
          message = success ? 'Title updated successfully' : 'Failed to update title';
          break;

        case 'schema':
          try {
            const schemaData = JSON.parse(fix.newValue);
            success = await this.addSchemaMarkup(fix.postId, schemaData);
            message = success ? 'Schema markup added successfully' : 'Failed to add schema markup';
          } catch {
            message = 'Invalid schema JSON format';
          }
          break;

        case 'internal_links':
          try {
            const links = JSON.parse(fix.newValue);
            success = await this.addInternalLinks(fix.postId, links);
            message = success ? 'Internal links added successfully' : 'Failed to add internal links';
          } catch {
            message = 'Invalid links format';
          }
          break;

        case 'alt_text':
          success = await this.updateImageAltText(fix.postId, fix.newValue);
          message = success ? 'Image alt text updated successfully' : 'Failed to update alt text';
          break;

        case 'title_optimization':
          // Optimize long titles by shortening while preserving key information
          success = await this.updatePostTitle(targetPostId, fix.newValue);
          message = success ? 'Title optimized successfully' : 'Failed to optimize title';
          break;

        case 'content_expansion':
          // Expand thin content with additional relevant information
          success = await this.expandPostContent(targetPostId, fix.newValue);
          message = success ? 'Content expanded successfully' : 'Failed to expand content';
          break;

        default:
          message = 'Unsupported fix type';
      }

      return { success, message };
    } catch (error) {
      console.error('Error applying SEO fix:', error);
      return { success: false, message: 'Unexpected error occurred' };
    }
  }

  async batchApplyFixes(fixes: SEOFix[]): Promise<Array<{ fix: SEOFix; result: { success: boolean; message: string } }>> {
    const results = [];

    for (const fix of fixes) {
      const result = await this.applySEOFix(fix);
      results.push({ fix, result });
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}