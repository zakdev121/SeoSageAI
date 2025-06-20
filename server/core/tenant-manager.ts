import { SEOEngine } from './seo-engine.js';

/**
 * Multi-Tenant SaaS Management System
 * Handles client isolation, billing, and feature access
 */
export class TenantManager {
  private engines: Map<string, SEOEngine> = new Map();
  private tenantConfigs: Map<string, TenantConfig> = new Map();

  constructor() {
    this.initializeDefaultTenants();
  }

  private initializeDefaultTenants(): void {
    // Synviz as the first client
    const synvizConfig: TenantConfig = {
      tenantId: 'synviz',
      name: 'Synviz',
      website: 'synviz.com',
      industry: 'Tech Services, AI & Automation, IT Staffing',
      plan: 'enterprise',
      features: {
        auditsPerMonth: -1, // unlimited
        fixesPerMonth: -1,  // unlimited
        competitorAnalysis: true,
        customReporting: true,
        apiAccess: true,
        whiteLabel: false,
        dedicatedSupport: true
      },
      wpCredentials: {
        username: process.env.WP_USERNAME || '',
        password: process.env.WP_APP_PASSWORD || '',
        siteUrl: 'https://synviz.com'
      },
      created: new Date('2025-06-20'),
      status: 'active'
    };

    this.tenantConfigs.set('synviz', synvizConfig);
    this.engines.set('synviz', new SEOEngine('synviz'));
  }

  /**
   * Get SEO engine for specific tenant
   */
  getEngine(tenantId: string): SEOEngine | null {
    if (!this.engines.has(tenantId)) {
      const config = this.tenantConfigs.get(tenantId);
      if (config && config.status === 'active') {
        this.engines.set(tenantId, new SEOEngine(tenantId));
      }
    }
    return this.engines.get(tenantId) || null;
  }

  /**
   * Register new SaaS client
   */
  async registerTenant(tenantData: TenantRegistration): Promise<TenantConfig> {
    const tenantId = this.generateTenantId(tenantData.name);
    
    const config: TenantConfig = {
      tenantId,
      name: tenantData.name,
      website: tenantData.website,
      industry: tenantData.industry,
      plan: tenantData.plan || 'starter',
      features: this.getFeaturesByPlan(tenantData.plan || 'starter'),
      wpCredentials: tenantData.wpCredentials,
      created: new Date(),
      status: 'active'
    };

    this.tenantConfigs.set(tenantId, config);
    this.engines.set(tenantId, new SEOEngine(tenantId));

    return config;
  }

  /**
   * Validate tenant access and usage limits
   */
  async validateAccess(tenantId: string, operation: string): Promise<AccessValidation> {
    const config = this.tenantConfigs.get(tenantId);
    
    if (!config) {
      return {
        allowed: false,
        reason: 'Tenant not found',
        remainingQuota: 0
      };
    }

    if (config.status !== 'active') {
      return {
        allowed: false,
        reason: 'Account suspended or inactive',
        remainingQuota: 0
      };
    }

    // Check feature access
    switch (operation) {
      case 'audit':
        if (config.features.auditsPerMonth === 0) {
          return {
            allowed: false,
            reason: 'Monthly audit limit reached',
            remainingQuota: 0
          };
        }
        break;
      
      case 'fix':
        if (config.features.fixesPerMonth === 0) {
          return {
            allowed: false,
            reason: 'Monthly fix limit reached',
            remainingQuota: config.features.fixesPerMonth
          };
        }
        break;
      
      case 'competitor_analysis':
        if (!config.features.competitorAnalysis) {
          return {
            allowed: false,
            reason: 'Competitor analysis not available in current plan',
            remainingQuota: 0
          };
        }
        break;
    }

    return {
      allowed: true,
      remainingQuota: config.features.auditsPerMonth === -1 ? -1 : config.features.auditsPerMonth
    };
  }

  /**
   * Track usage for billing and limits
   */
  async trackUsage(tenantId: string, operation: string, details: UsageDetails): Promise<void> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) return;

    // Update usage counters
    switch (operation) {
      case 'audit':
        if (config.features.auditsPerMonth > 0) {
          config.features.auditsPerMonth--;
        }
        break;
      
      case 'fix':
        if (config.features.fixesPerMonth > 0) {
          config.features.fixesPerMonth--;
        }
        break;
    }

    // Log for billing and analytics
    const usage: UsageRecord = {
      tenantId,
      operation,
      timestamp: new Date(),
      details,
      cost: this.calculateCost(operation, details)
    };

    console.log('Usage tracked:', usage);
    // TODO: Store in database for billing
  }

  /**
   * Get tenant configuration
   */
  getTenantConfig(tenantId: string): TenantConfig | null {
    return this.tenantConfigs.get(tenantId) || null;
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfig(tenantId: string, updates: Partial<TenantConfig>): Promise<boolean> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) return false;

    Object.assign(config, updates);
    this.tenantConfigs.set(tenantId, config);
    
    return true;
  }

  /**
   * List all tenants (admin function)
   */
  getAllTenants(): TenantConfig[] {
    return Array.from(this.tenantConfigs.values());
  }

  private generateTenantId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20) + '_' + Date.now().toString(36);
  }

  private getFeaturesByPlan(plan: string): TenantFeatures {
    const planFeatures: Record<string, TenantFeatures> = {
      starter: {
        auditsPerMonth: 5,
        fixesPerMonth: 10,
        competitorAnalysis: false,
        customReporting: false,
        apiAccess: false,
        whiteLabel: false,
        dedicatedSupport: false
      },
      professional: {
        auditsPerMonth: 25,
        fixesPerMonth: 50,
        competitorAnalysis: true,
        customReporting: true,
        apiAccess: true,
        whiteLabel: false,
        dedicatedSupport: false
      },
      enterprise: {
        auditsPerMonth: -1, // unlimited
        fixesPerMonth: -1,  // unlimited
        competitorAnalysis: true,
        customReporting: true,
        apiAccess: true,
        whiteLabel: true,
        dedicatedSupport: true
      }
    };

    return planFeatures[plan] || planFeatures.starter;
  }

  private calculateCost(operation: string, details: UsageDetails): number {
    const pricing = {
      audit: 0.50,
      fix: 0.25,
      competitor_analysis: 0.75,
      blog_generation: 1.00
    };

    return pricing[operation] || 0;
  }
}

// SaaS Types and Interfaces
export interface TenantConfig {
  tenantId: string;
  name: string;
  website: string;
  industry: string;
  plan: 'starter' | 'professional' | 'enterprise';
  features: TenantFeatures;
  wpCredentials?: WordPressCredentials;
  created: Date;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
}

export interface TenantFeatures {
  auditsPerMonth: number; // -1 for unlimited
  fixesPerMonth: number;  // -1 for unlimited
  competitorAnalysis: boolean;
  customReporting: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  dedicatedSupport: boolean;
}

export interface WordPressCredentials {
  username: string;
  password: string;
  siteUrl: string;
}

export interface TenantRegistration {
  name: string;
  website: string;
  industry: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  wpCredentials?: WordPressCredentials;
}

export interface AccessValidation {
  allowed: boolean;
  reason?: string;
  remainingQuota: number;
}

export interface UsageDetails {
  pageUrl?: string;
  issueType?: string;
  wordsGenerated?: number;
  apiCalls?: number;
  processingTime?: number;
}

export interface UsageRecord {
  tenantId: string;
  operation: string;
  timestamp: Date;
  details: UsageDetails;
  cost: number;
}

// Singleton instance for global access
export const tenantManager = new TenantManager();