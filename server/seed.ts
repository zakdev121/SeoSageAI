import { db } from './db';
import { users, tenants } from '@shared/schema';
import { hashPassword } from './auth';

export async function seedDatabase() {
  try {
    // Create Synviz tenant
    const [synvizTenant] = await db.insert(tenants).values({
      tenantId: 'synviz',
      name: 'Synviz',
      website: 'https://synviz.com',
      industry: 'SaaS',
      plan: 'enterprise',
      keywords: ['SEO', 'AI', 'automation', 'WordPress'],
      apiKeys: {
        googleApiKey: process.env.GOOGLE_API_KEY,
        googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
        wpUsername: process.env.WP_USERNAME,
        wpPassword: process.env.WP_APP_PASSWORD,
      },
      features: {
        auditsPerMonth: -1, // unlimited
        fixesPerMonth: -1, // unlimited
        competitorAnalysis: true,
        customReporting: true,
        apiAccess: true,
        whiteLabel: true,
        dedicatedSupport: true,
      },
    }).onConflictDoUpdate({
      target: tenants.tenantId,
      set: {
        apiKeys: {
          googleApiKey: process.env.GOOGLE_API_KEY,
          googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
          wpUsername: process.env.WP_USERNAME,
          wpPassword: process.env.WP_APP_PASSWORD,
        },
      },
    }).returning();

    // Create test user for you
    const testPassword = await hashPassword('seoai2024');
    const [testUser] = await db.insert(users).values({
      email: 'admin@synviz.com',
      password: testPassword,
      name: 'Synviz Admin',
      tenantId: 'synviz',
      role: 'admin',
    }).onConflictDoUpdate({
      target: users.email,
      set: {
        password: testPassword,
        lastLoginAt: new Date(),
      },
    }).returning();

    console.log('Database seeded successfully!');
    console.log('Test credentials:');
    console.log('Email: admin@synviz.com');
    console.log('Password: seoai2024');
    
    return { tenant: synvizTenant, user: testUser };
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}