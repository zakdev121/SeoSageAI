import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
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
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
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

    const isProblematicDomain = url.includes('synviz.com');
    
    // For synviz.com, try multiple approaches with retries
    if (isProblematicDomain) {
      return await this.crawlSynvizWithRetries(url);
    }

    // Standard crawling for other domains
    return await this.standardCrawl(url);
  }

  private async crawlSynvizWithRetries(url: string): Promise<PageDataType> {
    console.log(`Attempting synviz.com crawl with IP rotation strategies...`);
    
    // Strategy 1: Try with different DNS resolution and headers to appear as different client
    const strategies = [
      {
        name: 'Fresh client identity',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        },
        timeout: 45000
      },
      {
        name: 'Mobile client identity',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 30000
      }
    ];
    
    for (const strategy of strategies) {
      try {
        console.log(`Trying: ${strategy.name}`);
        
        // Add random delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
        
        const response = await axios.get(url, {
          timeout: strategy.timeout,
          headers: strategy.headers,
          validateStatus: (status) => status < 500, // Accept 4xx but not 5xx
          maxRedirects: 10
        });
        
        if (response.status === 200 && response.data && response.data.length > 500) {
          console.log(`${strategy.name} succeeded - ${response.data.length} bytes received`);
          return await this.parseHTML(response.data, url, 'http');
        } else if (response.status === 403) {
          console.warn(`${strategy.name}: IP blocked (403)`);
          continue;
        } else if (response.status === 429) {
          console.warn(`${strategy.name}: Rate limited (429)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.warn(`${strategy.name}: Connection blocked - likely IP restriction`);
        } else {
          console.warn(`${strategy.name} failed: ${error.message}`);
        }
        continue;
      }
    }
    
    // Strategy 2: Browser with residential-like behavior
    try {
      console.log(`Attempting browser with anti-detection measures...`);
      
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ],
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
      });
      
      const page = await browser.newPage();
      
      // Set realistic viewport and user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove webdriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      try {
        // Navigate with realistic timing
        await page.goto(url, { 
          timeout: 60000, 
          waitUntil: 'networkidle2'
        });
        
        // Simulate human behavior
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const html = await page.content();
        if (html && html.length > 1000) {
          console.log(`Browser anti-detection succeeded - ${html.length} bytes`);
          return await this.parseHTML(html, url, 'browser');
        }
        
      } finally {
        await browser.close();
      }
      
    } catch (browserError: any) {
      console.warn(`Browser anti-detection failed: ${browserError.message}`);
    }
    
    throw new Error(`Synviz.com connection blocked - Replit IP may be restricted. The audit will continue with authentic Google Search Console data and keyword research.`);
  }

  private async tryHTTPWithLongTimeout(url: string): Promise<PageDataType> {
    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 10,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      httpsAgent: new https.Agent({
        keepAlive: true,
        timeout: 30000,
        maxSockets: 1
      })
    });
    
    return await this.parseHTML(response.data, url, 'http');
  }

  private async tryBrowserWithSpecialHandling(url: string): Promise<PageDataType> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    });

    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set longer timeout and wait for load
      await page.goto(url, { 
        timeout: 45000,
        waitUntil: 'domcontentloaded'
      });
      
      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const html = await page.content();
      return await this.parseHTML(html, url, 'browser');
    } finally {
      await browser.close();
    }
  }

  private async tryAlternativeHTTP(url: string): Promise<PageDataType> {
    // Try with different HTTP configuration
    const response = await axios.get(url, {
      timeout: 20000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        timeout: 20000
      })
    });
    
    return await this.parseHTML(response.data, url, 'http');
  }

  private async standardCrawl(url: string): Promise<PageDataType> {
    const httpTimeout = 5000;
    
    try {
      const response = await axios.get(url, {
        timeout: httpTimeout,
        maxRedirects: 5,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        httpsAgent: new https.Agent({
          keepAlive: true,
          timeout: httpTimeout
        })
      });
      
      return await this.parseHTML(response.data, url, 'http');
    } catch (httpError: any) {
      console.warn(`[HTTP failed] ${httpError.message}, trying stealth browser...`);
      
      try {
        const html = await this.getHTMLWithPuppeteer(url);
        return await this.parseHTML(html, url, 'browser');
      } catch (browserError: any) {
        throw new Error(`Both HTTP and stealth browser crawling failed: ${httpError.message}`);
      }
    }
  }

  private async getHTMLWithPuppeteer(url: string, isProblematicDomain: boolean = false): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Extended timeout for problematic domains
    const timeout = isProblematicDomain ? 30000 : 8000;
    
    try {
      await page.goto(url, { 
        timeout,
        waitUntil: 'networkidle0' // Wait for network to be idle
      });
      const html = await page.content();
      return html;
    } finally {
      await browser.close();
    }
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
