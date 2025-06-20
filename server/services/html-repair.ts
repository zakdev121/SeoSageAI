import axios from 'axios';
import * as cheerio from 'cheerio';
import { htmlIntegrityService } from './html-integrity.js';

export interface HTMLRepairPlan {
  pageUrl: string;
  currentIssues: string[];
  repairActions: Array<{
    issue: string;
    solution: string;
    codeExample: string;
    riskLevel: 'low' | 'medium' | 'high';
    estimatedTime: string;
  }>;
  expectedOutcome: string;
  backupRequired: boolean;
}

export class HTMLRepairService {
  async analyzeRepairNeeds(url: string): Promise<HTMLRepairPlan> {
    const integrityReport = await htmlIntegrityService.checkPageIntegrity(url);
    
    const repairActions = [];
    
    // Address unclosed tags
    if (integrityReport.criticalErrors.some(error => error.includes('unclosed'))) {
      repairActions.push({
        issue: 'Unclosed HTML tags',
        solution: 'Close all open HTML tags in proper order',
        codeExample: `<!-- Fix unclosed tags -->
<!-- Before: <div><p>Content -->
<!-- After: <div><p>Content</p></div> -->`,
        riskLevel: 'medium' as const,
        estimatedTime: '10-15 minutes'
      });
    }

    // Address DOCTYPE issues
    if (!integrityReport.hasValidDoctype) {
      repairActions.push({
        issue: 'Missing or invalid DOCTYPE',
        solution: 'Add proper HTML5 DOCTYPE declaration',
        codeExample: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
        riskLevel: 'low' as const,
        estimatedTime: '2-3 minutes'
      });
    }

    // Address HEAD structure
    if (!integrityReport.hasValidHead) {
      repairActions.push({
        issue: 'Invalid HEAD section structure',
        solution: 'Ensure single, properly structured HEAD section',
        codeExample: `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <!-- Meta descriptions and other meta tags here -->
</head>`,
        riskLevel: 'medium' as const,
        estimatedTime: '5-8 minutes'
      });
    }

    // Address BODY structure
    if (!integrityReport.hasValidBody) {
      repairActions.push({
        issue: 'Invalid BODY section structure',
        solution: 'Ensure single, properly structured BODY section',
        codeExample: `<body>
  <!-- All visible content here -->
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</body>`,
        riskLevel: 'high' as const,
        estimatedTime: '15-20 minutes'
      });
    }

    return {
      pageUrl: url,
      currentIssues: integrityReport.criticalErrors,
      repairActions,
      expectedOutcome: `After repairs, the page will have clean HTML structure allowing safe SEO fixes. Meta descriptions, title tags, and content modifications can be applied without risk of page corruption.`,
      backupRequired: repairActions.some(action => action.riskLevel === 'high')
    };
  }

  async generateRepairScript(url: string): Promise<string> {
    const repairPlan = await this.analyzeRepairNeeds(url);
    
    // Generate WordPress plugin code to fix HTML issues
    return `<?php
/**
 * HTML Integrity Repair Plugin for ${new URL(url).pathname}
 * Generated automatically by SEO AI Agent
 */

// Add to functions.php or create as a plugin

function repair_html_integrity_${Date.now()}() {
    // Only run on the specific problematic page
    if (!is_page('${new URL(url).pathname.replace('/', '')}')) {
        return;
    }
    
    // Buffer output to fix HTML structure
    ob_start(function($content) {
        // Fix common HTML issues
        
        // Ensure proper DOCTYPE
        if (!preg_match('/<!DOCTYPE html>/i', $content)) {
            $content = '<!DOCTYPE html>' . $content;
        }
        
        // Close unclosed div tags
        $openDivs = substr_count($content, '<div') - substr_count($content, '</div>');
        if ($openDivs > 0) {
            $content .= str_repeat('</div>', $openDivs);
        }
        
        // Close unclosed p tags
        $openPs = substr_count($content, '<p>') - substr_count($content, '</p>');
        if ($openPs > 0) {
            $content .= str_repeat('</p>', $openPs);
        }
        
        // Ensure single head and body tags
        $content = preg_replace('/<head[^>]*>/i', '<head>', $content, 1);
        $content = preg_replace('/<body[^>]*>/i', '<body>', $content, 1);
        
        return $content;
    });
}

// Hook into WordPress
add_action('template_redirect', 'repair_html_integrity_${Date.now()}');

// Alternative: Use WordPress filters for cleaner approach
function clean_html_output_${Date.now()}($content) {
    if (!is_page('${new URL(url).pathname.replace('/', '')}')) {
        return $content;
    }
    
    // Load content into DOM parser for proper fixes
    $dom = new DOMDocument('1.0', 'UTF-8');
    libxml_use_internal_errors(true);
    
    // Load HTML with proper encoding
    $dom->loadHTML('<?xml encoding="UTF-8">' . $content, LIBXML_HTML_DOCTYPEXML | LIBXML_HTML_NOIMPLIED);
    
    // Fix structure issues
    $xpath = new DOMXPath($dom);
    
    // Remove duplicate meta tags if any
    $metaTags = $xpath->query('//meta[@name]');
    $seen = array();
    foreach ($metaTags as $meta) {
        $name = $meta->getAttribute('name');
        if (in_array($name, $seen)) {
            $meta->parentNode->removeChild($meta);
        } else {
            $seen[] = $name;
        }
    }
    
    return $dom->saveHTML();
}

add_filter('the_content', 'clean_html_output_${Date.now()}');
?>`;
  }

  async validateRepair(url: string): Promise<{
    isRepaired: boolean;
    remainingIssues: string[];
    readyForSEOFixes: boolean;
  }> {
    const afterReport = await htmlIntegrityService.checkPageIntegrity(url);
    
    return {
      isRepaired: afterReport.criticalErrors.length === 0,
      remainingIssues: afterReport.criticalErrors,
      readyForSEOFixes: afterReport.isValid && afterReport.hasValidHead && afterReport.hasValidBody
    };
  }
}

export const htmlRepairService = new HTMLRepairService();