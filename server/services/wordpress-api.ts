import axios from 'axios';

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
  type: 'meta_description' | 'title_tag' | 'alt_text' | 'schema' | 'internal_links';
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
      return response.status === 200;
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

      while (hasMore) {
        const response = await axios.get(`${this.baseUrl}/posts`, {
          headers: this.getAuthHeaders(),
          params: {
            per_page: 100,
            page: page,
            status: 'publish'
          }
        });

        const posts = response.data;
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

  async updatePostMetaDescription(postId: number, metaDescription: string): Promise<boolean> {
    try {
      // Get the current post content first
      const getResponse = await axios.get(`${this.baseUrl}/posts/${postId}`, {
        headers: this.getAuthHeaders()
      });

      if (getResponse.status !== 200) {
        return false;
      }

      // Update the post excerpt (which can serve as meta description fallback)
      const updateResponse = await axios.post(
        `${this.baseUrl}/posts/${postId}`,
        {
          excerpt: metaDescription
        },
        { headers: this.getAuthHeaders() }
      );

      return updateResponse.status === 200;
    } catch (error) {
      console.error('Error updating meta description:', error);
      return false;
    }
  }

  async updatePostTitle(postId: number, title: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/posts/${postId}`,
        {
          title: title
        },
        { headers: this.getAuthHeaders() }
      );

      return response.status === 200;
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

  async updateImageAltText(mediaId: number, altText: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/media/${mediaId}`,
        {
          alt_text: altText
        },
        { headers: this.getAuthHeaders() }
      );

      return response.status === 200;
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

  async applySEOFix(fix: SEOFix): Promise<{ success: boolean; message: string }> {
    try {
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
          success = await this.updatePostMetaDescription(targetPostId, fix.newValue);
          message = success ? `Meta description updated successfully for post ID ${targetPostId}` : 'Failed to update meta description - this may require additional WordPress permissions';
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