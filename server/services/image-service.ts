import fetch from 'node-fetch';

export interface ImageResult {
  url: string;
  alt: string;
  attribution: string;
  width: number;
  height: number;
}

export class ImageService {
  private unsplashAccessKey: string;
  private pexelsApiKey: string;

  constructor() {
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || '';
    this.pexelsApiKey = process.env.PEXELS_API_KEY || '';
  }

  /**
   * Get relevant images for blog content based on keywords
   */
  async getRelevantImages(topic: string, keywords: string[], count: number = 3): Promise<ImageResult[]> {
    const images: ImageResult[] = [];
    
    try {
      // Try Unsplash first
      if (this.unsplashAccessKey && images.length < count) {
        const unsplashImages = await this.getUnsplashImages(topic, keywords, count - images.length);
        images.push(...unsplashImages);
      }

      // Fill remaining with Pexels if needed
      if (this.pexelsApiKey && images.length < count) {
        const pexelsImages = await this.getPexelsImages(topic, keywords, count - images.length);
        images.push(...pexelsImages);
      }

      // Generate SVG patterns as fallback
      if (images.length < count) {
        const svgImages = this.generateSVGPatterns(topic, count - images.length);
        images.push(...svgImages);
      }

    } catch (error) {
      console.error('Error fetching images:', error);
      // Return SVG patterns as fallback
      return this.generateSVGPatterns(topic, count);
    }

    return images.slice(0, count);
  }

  /**
   * Fetch images from Unsplash API
   */
  private async getUnsplashImages(topic: string, keywords: string[], count: number): Promise<ImageResult[]> {
    if (!this.unsplashAccessKey) return [];

    const query = this.buildSearchQuery(topic, keywords);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Client-ID ${this.unsplashAccessKey}`
        }
      });

      if (!response.ok) {
        console.warn('Unsplash API error:', response.status);
        return [];
      }

      const data = await response.json() as any;
      
      return data.results?.map((photo: any) => ({
        url: photo.urls.regular,
        alt: photo.alt_description || `Image related to ${topic}`,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
        width: photo.width,
        height: photo.height
      })) || [];

    } catch (error) {
      console.error('Unsplash fetch error:', error);
      return [];
    }
  }

  /**
   * Fetch images from Pexels API
   */
  private async getPexelsImages(topic: string, keywords: string[], count: number): Promise<ImageResult[]> {
    if (!this.pexelsApiKey) return [];

    const query = this.buildSearchQuery(topic, keywords);
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': this.pexelsApiKey
        }
      });

      if (!response.ok) {
        console.warn('Pexels API error:', response.status);
        return [];
      }

      const data = await response.json() as any;
      
      return data.photos?.map((photo: any) => ({
        url: photo.src.large,
        alt: photo.alt || `Image related to ${topic}`,
        attribution: `Photo by ${photo.photographer} on Pexels`,
        width: photo.width,
        height: photo.height
      })) || [];

    } catch (error) {
      console.error('Pexels fetch error:', error);
      return [];
    }
  }

  /**
   * Generate SVG patterns as fallback images
   */
  private generateSVGPatterns(topic: string, count: number): ImageResult[] {
    const patterns = [
      this.createGradientSVG(topic, 'linear'),
      this.createGradientSVG(topic, 'radial'),
      this.createGeometricSVG(topic),
      this.createWaveSVG(topic),
      this.createDotPatternSVG(topic)
    ];

    return patterns.slice(0, count).map((svg, index) => ({
      url: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      alt: `Generated pattern for ${topic}`,
      attribution: 'Generated SVG Pattern',
      width: 800,
      height: 400
    }));
  }

  /**
   * Create gradient SVG pattern
   */
  private createGradientSVG(topic: string, type: 'linear' | 'radial'): string {
    const colors = this.getTopicColors(topic);
    const gradientId = `gradient-${Date.now()}`;
    
    const gradient = type === 'linear' 
      ? `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
           <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
         </linearGradient>`
      : `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">
           <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
           <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
         </radialGradient>`;

    return `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>${gradient}</defs>
      <rect width="100%" height="100%" fill="url(#${gradientId})" />
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="white" opacity="0.8">
        ${topic.toUpperCase()}
      </text>
    </svg>`;
  }

  /**
   * Create geometric pattern SVG
   */
  private createGeometricSVG(topic: string): string {
    const colors = this.getTopicColors(topic);
    
    return `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors.background}" />
      <g opacity="0.1">
        ${Array.from({length: 20}, (_, i) => {
          const x = (i % 5) * 160 + 80;
          const y = Math.floor(i / 5) * 100 + 50;
          return `<circle cx="${x}" cy="${y}" r="40" fill="${colors.primary}" />`;
        }).join('')}
      </g>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="${colors.text}">
        ${topic.toUpperCase()}
      </text>
    </svg>`;
  }

  /**
   * Create wave pattern SVG
   */
  private createWaveSVG(topic: string): string {
    const colors = this.getTopicColors(topic);
    
    return `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors.background}" />
      <path d="M0,200 Q200,100 400,200 T800,200 L800,400 L0,400 Z" fill="${colors.primary}" opacity="0.3" />
      <path d="M0,250 Q200,150 400,250 T800,250 L800,400 L0,400 Z" fill="${colors.secondary}" opacity="0.3" />
      <text x="50%" y="30%" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="${colors.text}">
        ${topic.toUpperCase()}
      </text>
    </svg>`;
  }

  /**
   * Create dot pattern SVG
   */
  private createDotPatternSVG(topic: string): string {
    const colors = this.getTopicColors(topic);
    
    return `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors.background}" />
      <defs>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="3" fill="${colors.primary}" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="${colors.text}">
        ${topic.toUpperCase()}
      </text>
    </svg>`;
  }

  /**
   * Get topic-appropriate colors
   */
  private getTopicColors(topic: string): { primary: string; secondary: string; background: string; text: string } {
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('tech') || topicLower.includes('ai') || topicLower.includes('software')) {
      return { primary: '#3B82F6', secondary: '#1E40AF', background: '#F1F5F9', text: '#1E293B' };
    }
    
    if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('wellness')) {
      return { primary: '#10B981', secondary: '#059669', background: '#F0FDF4', text: '#065F46' };
    }
    
    if (topicLower.includes('business') || topicLower.includes('finance') || topicLower.includes('marketing')) {
      return { primary: '#8B5CF6', secondary: '#7C3AED', background: '#FAF5FF', text: '#581C87' };
    }
    
    if (topicLower.includes('education') || topicLower.includes('learning') || topicLower.includes('training')) {
      return { primary: '#F59E0B', secondary: '#D97706', background: '#FFFBEB', text: '#92400E' };
    }
    
    // Default colors
    return { primary: '#6366F1', secondary: '#4F46E5', background: '#F8FAFC', text: '#334155' };
  }

  /**
   * Build search query from topic and keywords
   */
  private buildSearchQuery(topic: string, keywords: string[]): string {
    const cleanTopic = topic.replace(/[^\w\s]/g, '').trim();
    const cleanKeywords = keywords.map(k => k.replace(/[^\w\s]/g, '').trim()).filter(k => k.length > 0);
    
    return [cleanTopic, ...cleanKeywords.slice(0, 2)].join(' ');
  }

  /**
   * Inject images into blog content HTML
   */
  injectImagesIntoContent(content: string, images: ImageResult[]): string {
    if (!images.length) return content;

    // Find H2 sections to inject images
    const h2Regex = /<h2[^>]*>.*?<\/h2>/gi;
    const h2Matches = content.match(h2Regex);
    
    if (!h2Matches || h2Matches.length === 0) return content;

    let updatedContent = content;
    let imageIndex = 0;

    // Inject images after every 2-3 H2 sections
    h2Matches.forEach((h2Tag, index) => {
      if (imageIndex < images.length && (index + 1) % 2 === 0) {
        const image = images[imageIndex];
        const imageHtml = `
        <div class="blog-image-container" style="margin: 2rem 0; text-align: center;">
          <img src="${image.url}" alt="${image.alt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" loading="lazy" />
          <p style="font-size: 0.875rem; color: #666; margin-top: 0.5rem; font-style: italic;">${image.attribution}</p>
        </div>`;
        
        updatedContent = updatedContent.replace(h2Tag, h2Tag + imageHtml);
        imageIndex++;
      }
    });

    // Add hero image at the beginning if we have images left
    if (imageIndex < images.length) {
      const heroImage = images[imageIndex];
      const heroImageHtml = `
      <div class="blog-hero-image" style="margin: 2rem 0; text-align: center;">
        <img src="${heroImage.url}" alt="${heroImage.alt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" loading="lazy" />
        <p style="font-size: 0.875rem; color: #666; margin-top: 0.5rem; font-style: italic;">${heroImage.attribution}</p>
      </div>`;
      
      // Insert after the first paragraph or H1
      const firstParagraphMatch = updatedContent.match(/<p[^>]*>.*?<\/p>/i);
      if (firstParagraphMatch) {
        updatedContent = updatedContent.replace(firstParagraphMatch[0], firstParagraphMatch[0] + heroImageHtml);
      }
    }

    return updatedContent;
  }
}

export const imageService = new ImageService();