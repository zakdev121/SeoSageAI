import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PageDataType } from '@shared/schema';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

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
    const results: PageDataType[] = [];
    const visited = new Set<string>();
    const toVisit = [url];

    while (toVisit.length > 0 && results.length < maxPages) {
      const currentUrl = toVisit.shift()!;
      if (visited.has(currentUrl)) continue;
      
      visited.add(currentUrl);
      console.log(`Crawling page ${results.length + 1}/${maxPages}: ${currentUrl}`);
      
      try {
        const pageData = await this.crawlPageRobust(currentUrl);
        results.push(pageData);

        // Extract internal links for further crawling
        const baseUrl = new URL(url);
        pageData.internalLinks.slice(0, 10).forEach(link => {
          try {
            const linkUrl = new URL(link, baseUrl);
            if (linkUrl.hostname === baseUrl.hostname && !visited.has(linkUrl.href) && toVisit.length < maxPages * 2) {
              toVisit.push(linkUrl.href);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error);
        // Continue with next page if available
        if (toVisit.length === 0 && results.length === 0) {
          // If first page fails and no links to try, create minimal page data for analysis
          try {
            const baseUrl = new URL(currentUrl);
            results.push({
              url: currentUrl,
              title: baseUrl.hostname,
              metaDescription: '',
              h1: [],
              h2: [],
              wordCount: 0,
              images: [],
              internalLinks: [],
              externalLinks: [],
              brokenLinks: []
            });
          } catch (urlError) {
            // Even URL parsing failed - skip
          }
        }
      }
    }

    console.log(`Crawl completed: ${results.length} pages analyzed`);
    return results;
  }

  private async crawlPage(url: string): Promise<PageDataType> {
    const page = await this.browser!.newPage();
    
    try {
      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  private async crawlPageRobust(url: string): Promise<PageDataType> {
    // Ensure URL has protocol
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    // Try HTTP first for faster results with retry logic
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        if (retryAfter) {
          console.warn(`Rate limited, retry after ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
        }
      }
      
      return await this.parseHTML(response.data, url, 'http');
    } catch (httpError: any) {
      // Handle specific HTTP errors
      if (httpError.response?.status === 403) {
        console.warn(`[HTTP blocked] 403 Forbidden for ${url}, trying stealth browser...`);
      } else if (httpError.response?.status === 429) {
        console.warn(`[HTTP rate limited] 429 for ${url}, trying stealth browser...`);
      } else {
        console.warn(`[HTTP failed] ${httpError.message}, trying stealth browser...`);
      }
      
      try {
        // Fallback to Puppeteer with stealth mode
        const html = await this.getHTMLWithPuppeteer(url);
        return await this.parseHTML(html, url, 'browser');
      } catch (browserError: any) {
        throw new Error(`Both HTTP and stealth browser crawling failed: ${httpError.message}`);
      }
    }
  }

  private async getHTMLWithPuppeteer(url: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (SynvizBot)');
    await page.goto(url, { timeout: 8000 }); // Reduced timeout
    const html = await page.content();
    await browser.close();
    return html;
  }

  private async parseHTML(html: string, url: string, source: 'browser' | 'http'): Promise<PageDataType> {
    const $ = cheerio.load(html);

    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get();
    const h2 = $('h2').map((_, el) => $(el).text().trim()).get();
    
    const images = $('img').map((_, el) => ({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt') || ''
    })).get();

    // Extract internal and external links
    const baseUrl = new URL(url);
    const allLinks = $('a[href]').map((_, el) => $(el).attr('href')).get().filter(Boolean);
    
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const absoluteLinks: string[] = [];

    allLinks.forEach(href => {
      try {
        const linkUrl = new URL(href, baseUrl);
        absoluteLinks.push(linkUrl.href);
        
        if (linkUrl.hostname === baseUrl.hostname) {
          internalLinks.push(linkUrl.href);
        } else {
          externalLinks.push(linkUrl.href);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    // Check for broken links using HEAD requests
    const brokenLinks = await this.checkBrokenLinks(absoluteLinks.slice(0, 20)); // Limit to first 20 links

    // Calculate word count
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(/\s+/).length;

    return {
      url,
      title,
      metaDescription,
      h1,
      h2,
      wordCount,
      images,
      internalLinks: [...new Set(internalLinks)],
      externalLinks: [...new Set(externalLinks)],
      brokenLinks
    };
  }

  private async checkBrokenLinks(urls: string[]): Promise<string[]> {
    const results = await Promise.all(urls.map(async (link) => {
      try {
        const res = await axios.head(link, { timeout: 5000 });
        return res.status >= 400 ? link : null;
      } catch {
        return link;
      }
    }));

    return results.filter(Boolean) as string[];
  }

  async scrapeGoogleAutosuggest(keyword: string): Promise<string[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.browser!.newPage();
    
    try {
      await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
      
      // Wait for search input to be available
      await page.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 5000 });
      
      // Type the keyword using the most reliable selector
      const searchInput = await page.$('textarea[name="q"]') || await page.$('input[name="q"]');
      if (searchInput) {
        await searchInput.type(keyword);
      } else {
        throw new Error('Search input not found');
      }
      
      // Wait for suggestions to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract suggestions with multiple fallback selectors
      const suggestions = await page.evaluate(() => {
        const selectors = [
          '[role="option"] span',
          '.wM6W7d span',
          '.sbct span',
          '.erkvQe span'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return Array.from(elements).map(el => el.textContent?.trim()).filter(Boolean) as string[];
          }
        }
        return [];
      });

      return suggestions.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      console.error('Error scraping Google autosuggest:', error);
      // Return fallback keyword variations instead of empty array
      return [
        `${keyword} services`,
        `${keyword} solutions`,
        `${keyword} companies`,
        `${keyword} experts`,
        `${keyword} consulting`
      ];
    } finally {
      await page.close();
    }
  }
}
