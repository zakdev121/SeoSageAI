/**
 * Comprehensive test script for Synviz WordPress plugin API endpoints
 * Tests all endpoints: /synviz/v1/update-meta, /synviz/v1/optimize-title, 
 * /synviz/v1/update-alt-text, /synviz/v1/expand-content
 */

// Test script for Synviz WordPress plugin endpoints
const axios = require('axios');

async function testSynvizWordPressAPI() {
  console.log('🧪 Testing Synviz WordPress Plugin API Integration\n');

  // Test with a real WordPress site URL
  const siteUrl = 'synviz.com'; // Update this to your WordPress site
  const wpService = new WordPressService(siteUrl);

  try {
    // Test 1: Connection Test
    console.log('1️⃣  Testing WordPress connection...');
    const isConnected = await wpService.testConnection();
    console.log(`   WordPress connection: ${isConnected ? '✅ Success' : '❌ Failed'}\n`);

    if (!isConnected) {
      console.log('❌ Cannot proceed without WordPress connection. Check credentials and site URL.');
      return;
    }

    // Get a test post ID
    console.log('2️⃣  Fetching WordPress posts to get test post ID...');
    const posts = await wpService.getAllPosts();
    
    if (posts.length === 0) {
      console.log('❌ No posts found. Create at least one post for testing.');
      return;
    }

    const testPostId = posts[0].id;
    console.log(`   Using post ID ${testPostId} for testing: "${posts[0].title.rendered}"\n`);

    // Test 2: Meta Description Update (Synviz endpoint)
    console.log('3️⃣  Testing meta description update via Synviz plugin...');
    const metaResult = await wpService.updatePostMetaDescription(
      testPostId,
      'Test meta description updated via Synviz plugin endpoint'
    );
    console.log(`   Meta update result: ${metaResult.success ? '✅' : '❌'} ${metaResult.message}\n`);

    // Test 3: Title Optimization (Synviz endpoint)
    console.log('4️⃣  Testing title optimization via Synviz plugin...');
    const titleResult = await wpService.updatePostTitle(
      testPostId,
      'SEO Optimized Title - Updated via Synviz Plugin'
    );
    console.log(`   Title update result: ${titleResult.success ? '✅' : '❌'} ${titleResult.message}\n`);

    // Test 4: Alt Text Updates (Synviz endpoint)
    console.log('5️⃣  Testing alt text updates via Synviz plugin...');
    const altTextUpdates = [
      { original: 'old-alt-text', new: 'SEO optimized alt text description' },
      { original: 'image-alt', new: 'Detailed alt text for accessibility' }
    ];
    const altResult = await wpService.updateImageAltText(testPostId, altTextUpdates);
    console.log(`   Alt text update result: ${altResult.success ? '✅' : '❌'} ${altResult.message}\n`);

    // Test 5: Content Expansion (Synviz endpoint)
    console.log('6️⃣  Testing content expansion via Synviz plugin...');
    const additionalContent = `
    <h3>SEO Enhancement Section</h3>
    <p>This additional content was added via the Synviz plugin API to improve SEO value and user engagement.</p>
    <ul>
      <li>Enhanced keyword density</li>
      <li>Improved content depth</li>
      <li>Better user experience</li>
    </ul>
    `;
    const contentResult = await wpService.expandPostContent(testPostId, additionalContent);
    console.log(`   Content expansion result: ${contentResult.success ? '✅' : '❌'} ${contentResult.message}\n`);

    // Test 6: Comprehensive Post Data Retrieval
    console.log('7️⃣  Testing comprehensive post data retrieval...');
    const allContent = await wpService.getContentAsPageData();
    console.log(`   Retrieved ${allContent.length} pages/posts for SEO analysis\n`);

    // Test Summary
    console.log('📊 Test Summary:');
    console.log(`   WordPress Connection: ${isConnected ? '✅' : '❌'}`);
    console.log(`   Meta Description Update: ${metaResult.success ? '✅' : '❌'}`);
    console.log(`   Title Optimization: ${titleResult.success ? '✅' : '❌'}`);
    console.log(`   Alt Text Updates: ${altResult.success ? '✅' : '❌'}`);
    console.log(`   Content Expansion: ${contentResult.success ? '✅' : '❌'}`);
    console.log(`   Content Retrieval: ${allContent.length > 0 ? '✅' : '❌'}\n`);

    // Plugin Status Analysis
    const hasWorkingPlugin = [metaResult, titleResult, altResult, contentResult]
      .some(result => result.message.includes('Synviz plugin'));
    
    if (hasWorkingPlugin) {
      console.log('🎉 Synviz WordPress plugin is installed and working correctly!');
    } else {
      console.log('📋 Synviz plugin not detected. System providing manual implementation guidance.');
      console.log('   Install the Synviz plugin at /wp-content/plugins/synviz/ for automated fixes.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (error.message.includes('Authentication')) {
      console.log('\n🔐 Authentication Required:');
      console.log('   Please ensure WordPress application passwords are configured:');
      console.log('   1. Go to WordPress Admin → Users → Your Profile');
      console.log('   2. Scroll to "Application Passwords"');
      console.log('   3. Create a new application password for "SEO Agent"');
      console.log('   4. Update WP_USERNAME and WP_APP_PASSWORD environment variables');
    }
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSynvizWordPressAPI();
}

export { testSynvizWordPressAPI };