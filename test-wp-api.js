const { WordPressService } = require('./server/services/wordpress-api.ts');

async function testWordPressAPI() {
  try {
    console.log('Testing WordPress API connection...');
    const wpService = new WordPressService('https://synviz.com');
    
    // Test connection
    const connected = await wpService.testConnection();
    console.log('Connected:', connected);
    
    if (connected) {
      // Get content summary
      const content = await wpService.getAllContent();
      console.log('\n=== WORDPRESS CONTENT SUMMARY ===');
      console.log('Total Content:', content.totalContent);
      console.log('Posts Count:', content.posts.length);
      console.log('Pages Count:', content.pages.length);
      
      if (content.posts.length > 0) {
        console.log'\n=== SAMPLE POSTS ===');
        content.posts.slice(0, 3).forEach((post, i) => {
          console.log(`Post ${i + 1}:`);
          console.log(`  ID: ${post.id}`);
          console.log(`  Title: ${post.title?.rendered || 'No title'}`);
          console.log(`  Slug: ${post.slug}`);
          console.log(`  Content Length: ${post.content?.rendered?.length || 0} chars`);
        });
      }
      
      if (content.pages.length > 0) {
        console.log('\n=== SAMPLE PAGES ===');
        content.pages.slice(0, 3).forEach((page, i) => {
          console.log(`Page ${i + 1}:`);
          console.log(`  ID: ${page.id}`);
          console.log(`  Title: ${page.title?.rendered || 'No title'}`);
          console.log(`  Slug: ${page.slug}`);
          console.log(`  Content Length: ${page.content?.rendered?.length || 0} chars`);
        });
      }
    }
  } catch (error) {
    console.error('WordPress API test failed:', error.message);
  }
}

testWordPressAPI();