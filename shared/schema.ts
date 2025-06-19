import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  industry: text("industry").notNull(),
  email: text("email"),
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
});

export type PageDataType = z.infer<typeof PageData>;
export type GSCDataType = z.infer<typeof GSCData>;
export type KeywordOpportunityType = z.infer<typeof KeywordOpportunity>;
export type SEOIssueType = z.infer<typeof SEOIssue>;
export type AIRecommendationType = z.infer<typeof AIRecommendation>;
export type AuditResultsType = z.infer<typeof AuditResults>;
