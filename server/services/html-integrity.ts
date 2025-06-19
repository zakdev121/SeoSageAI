import axios from 'axios';
import * as cheerio from 'cheerio';

export interface HTMLIntegrityReport {
  isValid: boolean;
  hasValidDoctype: boolean;
  hasProperHtmlStructure: boolean;
  hasValidHead: boolean;
  hasValidBody: boolean;
  metaTagsCount: number;
  criticalErrors: string[];
  warnings: string[];
  structureHash: string;
}

export class HTMLIntegrityService {
  async checkPageIntegrity(url: string): Promise<HTMLIntegrityReport> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      const report: HTMLIntegrityReport = {
        isValid: true,
        hasValidDoctype: false,
        hasProperHtmlStructure: false,
        hasValidHead: false,
        hasValidBody: false,
        metaTagsCount: 0,
        criticalErrors: [],
        warnings: [],
        structureHash: this.generateStructureHash(html)
      };

      // Check DOCTYPE
      const doctype = html.match(/<!DOCTYPE[^>]*>/i);
      report.hasValidDoctype = !!doctype && doctype[0].toLowerCase().includes('html');
      if (!report.hasValidDoctype) {
        report.criticalErrors.push('Missing or invalid DOCTYPE declaration');
      }

      // Check HTML structure
      const htmlTags = $('html');
      report.hasProperHtmlStructure = htmlTags.length === 1;
      if (!report.hasProperHtmlStructure) {
        report.criticalErrors.push('Invalid HTML root structure');
      }

      // Check HEAD section
      const headTags = $('head');
      report.hasValidHead = headTags.length === 1;
      if (!report.hasValidHead) {
        report.criticalErrors.push('Missing or multiple HEAD sections');
      }

      // Check BODY section
      const bodyTags = $('body');
      report.hasValidBody = bodyTags.length === 1;
      if (!report.hasValidBody) {
        report.criticalErrors.push('Missing or multiple BODY sections');
      }

      // Count meta tags
      report.metaTagsCount = $('meta').length;

      // Check for unclosed tags or malformed HTML
      const unclosedTags = this.findUnclosedTags(html);
      if (unclosedTags.length > 0) {
        report.criticalErrors.push(`Unclosed tags detected: ${unclosedTags.join(', ')}`);
      }

      // Check for duplicate critical meta tags
      const titleTags = $('title').length;
      if (titleTags > 1) {
        report.warnings.push('Multiple title tags detected');
      } else if (titleTags === 0) {
        report.warnings.push('No title tag found');
      }

      // Check for charset declaration
      const charset = $('meta[charset]').length + $('meta[http-equiv="Content-Type"]').length;
      if (charset === 0) {
        report.warnings.push('No charset declaration found');
      }

      // Overall validity
      report.isValid = report.criticalErrors.length === 0;

      return report;

    } catch (error: any) {
      return {
        isValid: false,
        hasValidDoctype: false,
        hasProperHtmlStructure: false,
        hasValidHead: false,
        hasValidBody: false,
        metaTagsCount: 0,
        criticalErrors: [`Failed to fetch page: ${error.message}`],
        warnings: [],
        structureHash: ''
      };
    }
  }

  private generateStructureHash(html: string): string {
    // Create a hash of the core HTML structure (ignoring dynamic content)
    const structuralElements = html
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .match(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || [];
    
    return Buffer.from(structuralElements.join('')).toString('base64').substring(0, 32);
  }

  private findUnclosedTags(html: string): string[] {
    const unclosed: string[] = [];
    const voidElements = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    // Simple regex to find opening and closing tags
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    const tagStack: string[] = [];
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1].toLowerCase();
      const isClosing = match[0].startsWith('</');
      const isSelfClosing = match[0].endsWith('/>') || voidElements.has(tagName);

      if (isClosing) {
        if (tagStack.length === 0 || tagStack[tagStack.length - 1] !== tagName) {
          unclosed.push(tagName);
        } else {
          tagStack.pop();
        }
      } else if (!isSelfClosing) {
        tagStack.push(tagName);
      }
    }

    return [...unclosed, ...tagStack];
  }

  async compareIntegrity(beforeReport: HTMLIntegrityReport, afterReport: HTMLIntegrityReport): Promise<{
    hasStructuralChanges: boolean;
    newErrors: string[];
    resolvedErrors: string[];
    integrityMaintained: boolean;
  }> {
    const hasStructuralChanges = beforeReport.structureHash !== afterReport.structureHash;
    
    const beforeErrors = new Set(beforeReport.criticalErrors);
    const afterErrors = new Set(afterReport.criticalErrors);
    
    const newErrors = afterReport.criticalErrors.filter(error => !beforeErrors.has(error));
    const resolvedErrors = beforeReport.criticalErrors.filter(error => !afterErrors.has(error));
    
    const integrityMaintained = afterReport.isValid && newErrors.length === 0;

    return {
      hasStructuralChanges,
      newErrors,
      resolvedErrors,
      integrityMaintained
    };
  }
}

export const htmlIntegrityService = new HTMLIntegrityService();