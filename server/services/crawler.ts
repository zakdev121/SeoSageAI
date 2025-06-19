import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { PageDataType } from '@shared/schema';

export class CrawlerService {
  private browser: puppeteer.Browser | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async crawlWebsite(url: string, maxPages: number = 5): Promise<PageDataType[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const results: PageDataType[] = [];
    const visited = new Set<string>();
    const toVisit = [url];

    while (toVisit.length > 0 && results.length < maxPages) {
      const currentUrl = toVisit.shift()!;
      if (visited.has(currentUrl)) continue;
      
      visited.add(currentUrl);
      
      try {
        const pageData = await this.crawlPage(currentUrl);
        results.push(pageData);

        // Extract internal links for further crawling
        const baseUrl = new URL(url);
        pageData.internalLinks.forEach(link => {
          try {
            const linkUrl = new URL(link, baseUrl);
            if (linkUrl.hostname === baseUrl.hostname && !visited.has(linkUrl.href) && toVisit.length < maxPages) {
              toVisit.push(linkUrl.href);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error);
      }
    }

    return results;
  }

  private async crawlPage(url: string): Promise<PageDataType> {
    const page = await this.browser!.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract title
      const title = $('title').text().trim();

      // Extract meta description
      const metaDescription = $('meta[name="description"]').attr('content')?.trim();

      // Extract headings
      const h1 = $('h1').map((_, el) => $(el).text().trim()).get();
      const h2 = $('h2').map((_, el) => $(el).text().trim()).get();

      // Count words in body text
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = bodyText.split(' ').filter(word => word.length > 0).length;

      // Extract images
      const images = $('img').map((_, el) => {
        const $img = $(el);
        return {
          src: $img.attr('src') || '',
          alt: $img.attr('alt'),
          size: undefined // We'll skip actual size calculation for now
        };
      }).get();

      // Extract links
      const allLinks = $('a[href]').map((_, el) => $(el).attr('href')).get();
      const baseUrl = new URL(url);
      
      const internalLinks: string[] = [];
      const externalLinks: string[] = [];
      const brokenLinks: string[] = [];

      for (const link of allLinks) {
        if (!link) continue;
        
        try {
          const linkUrl = new URL(link, baseUrl);
          if (linkUrl.hostname === baseUrl.hostname) {
            internalLinks.push(linkUrl.href);
          } else {
            externalLinks.push(linkUrl.href);
          }
        } catch (e) {
          brokenLinks.push(link);
        }
      }

      return {
        url,
        title: title || undefined,
        metaDescription: metaDescription || undefined,
        h1,
        h2,
        wordCount,
        images,
        internalLinks: [...new Set(internalLinks)], // Remove duplicates
        externalLinks: [...new Set(externalLinks)],
        brokenLinks: [...new Set(brokenLinks)]
      };
    } finally {
      await page.close();
    }
  }

  async scrapeGoogleAutosuggest(keyword: string): Promise<string[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
      
      // Type the keyword
      await page.type('input[name="q"]', keyword);
      
      // Wait a bit for suggestions to load
      await page.waitForTimeout(1000);
      
      // Extract suggestions
      const suggestions = await page.evaluate(() => {
        const suggestionElements = document.querySelectorAll('[role="option"] span');
        return Array.from(suggestionElements).map(el => el.textContent?.trim()).filter(Boolean) as string[];
      });

      return suggestions.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      console.error('Error scraping Google autosuggest:', error);
      return [];
    } finally {
      await page.close();
    }
  }
}
