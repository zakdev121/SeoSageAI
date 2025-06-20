import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User authentication and tenant management
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"), // user, admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  website: varchar("website", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  keywords: jsonb("keywords").$type<string[]>().default([]),
  apiKeys: jsonb("api_keys").$type<{
    googleApiKey?: string;
    googleSearchEngineId?: string;
    wpUsername?: string;
    wpPassword?: string;
  }>().default({}),
  features: jsonb("features").$type<{
    auditsPerMonth: number;
    fixesPerMonth: number;
    competitorAnalysis: boolean;
    customReporting: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
  }>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  industry: text("industry").notNull(),
  email: text("email"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  userId: integer("user_id").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  results: jsonb("results"), // Store the complete audit results
});

export const insertAuditSchema = createInsertSchema(audits).pick({
  url: true,
  industry: true,
  email: true,
});

export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof audits.$inferSelect;

// User and tenant types
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  tenantId: true,
});

export const insertTenantSchema = createInsertSchema(tenants).pick({
  tenantId: true,
  name: true,
  website: true,
  industry: true,
  plan: true,
  keywords: true,
  apiKeys: true,
  features: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  website: z.string().url(),
  industry: z.string().min(2),
  keywords: z.array(z.string()).min(1),
  plan: z.enum(["starter", "professional", "enterprise"]).default("starter"),
  apiKeys: z.object({
    googleApiKey: z.string().optional(),
    googleSearchEngineId: z.string().optional(),
    wpUsername: z.string().optional(),
    wpPassword: z.string().optional(),
  }).optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;

// SEO Data Types
export const PageData = z.object({
  url: z.string(),
  title: z.string().optional(),
  metaDescription: z.string().optional(),
  h1: z.array(z.string()),
  h2: z.array(z.string()),
  wordCount: z.number(),
  images: z.array(z.object({
    src: z.string(),
    alt: z.string().optional(),
    size: z.number().optional(),
  })),
  internalLinks: z.array(z.string()),
  externalLinks: z.array(z.string()),
  brokenLinks: z.array(z.string()),
});

export const GSCData = z.object({
  totalClicks: z.number(),
  totalImpressions: z.number(),
  avgCTR: z.number(),
  avgPosition: z.number(),
  topQueries: z.array(z.object({
    query: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
  })),
  topPages: z.array(z.object({
    page: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
  })),
});

export const KeywordOpportunity = z.object({
  keyword: z.string(),
  position: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  ctr: z.number(),
  opportunity: z.enum(["high", "medium", "low"]),
  suggestions: z.array(z.string()),
});

export const SEOIssue = z.object({
  type: z.string(),
  severity: z.enum(["critical", "medium", "low"]),
  message: z.string(),
  page: z.string().optional(),
  count: z.number().optional(),
});

export const AIRecommendation = z.object({
  type: z.enum(["blog", "faq", "meta", "content"]),
  title: z.string(),
  description: z.string(),
  targetKeyword: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
  content: z.string().optional(),
});

export const PageSpeedData = z.object({
  url: z.string(),
  performanceScore: z.number(),
  accessibilityScore: z.number(),
  bestPracticesScore: z.number(),
  seoScore: z.number(),
  firstContentfulPaint: z.number(),
  largestContentfulPaint: z.number(),
  cumulativeLayoutShift: z.number(),
  opportunities: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    savings: z.number()
  })),
  diagnostics: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    displayValue: z.string()
  }))
});

export const CompetitorData = z.object({
  domain: z.string(),
  title: z.string(),
  snippet: z.string(),
  ranking: z.number()
});

export const KeywordLandscape = z.object({
  keyword: z.string(),
  topDomains: z.array(z.string()),
  searchVolume: z.enum(['high', 'medium', 'low']),
  competition: z.enum(['high', 'medium', 'low'])
});

export const AuditResults = z.object({
  url: z.string(),
  industry: z.string(),
  analyzedAt: z.string(),
  stats: z.object({
    pagesAnalyzed: z.number(),
    seoScore: z.number(),
    issues: z.number(),
    opportunities: z.number(),
  }),
  pages: z.array(PageData),
  gscData: GSCData.optional(),
  issues: z.array(SEOIssue),
  keywordOpportunities: z.array(KeywordOpportunity),
  longtailKeywords: z.array(z.object({
    keyword: z.string(),
    volume: z.number(),
    competition: z.enum(["low", "medium", "high"]),
  })),
  aiRecommendations: z.array(AIRecommendation),
  pageSpeedData: PageSpeedData.optional(),
  competitors: z.array(CompetitorData).optional(),
  keywordLandscape: z.array(KeywordLandscape).optional()
});

export type PageDataType = z.infer<typeof PageData>;
export type GSCDataType = z.infer<typeof GSCData>;
export type KeywordOpportunityType = z.infer<typeof KeywordOpportunity>;
export type SEOIssueType = z.infer<typeof SEOIssue>;
export type AIRecommendationType = z.infer<typeof AIRecommendation>;
export type PageSpeedDataType = z.infer<typeof PageSpeedData>;
export type CompetitorDataType = z.infer<typeof CompetitorData>;
export type KeywordLandscapeType = z.infer<typeof KeywordLandscape>;
export type AuditResultsType = z.infer<typeof AuditResults>;
