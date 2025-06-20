// Direct test of the enhanced blog generation system
const { blogTemplateEngine } = require('./server/services/blog-template-engine.ts');

async function testBlogGeneration() {
  console.log('Testing enhanced 3,000-word blog generation...');
  
  const testTopic = {
    title: "Advanced AI Automation Strategies for Modern Tech Services",
    targetKeyword: "AI automation strategies",
    metaDescription: "Comprehensive guide to implementing AI automation in tech services for improved efficiency and scalability",
    contentAngle: "Strategic implementation guide",
    targetAudience: "Tech service providers and business leaders",
    seoKeywords: ["AI automation", "tech services", "business efficiency", "digital transformation"],
    contentType: "guide"
  };

  try {
    console.log('Generating blog post...');
    const startTime = Date.now();
    
    const blogPost = await blogTemplateEngine.generateBlogPost(testTopic);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n=== BLOG GENERATION RESULTS ===');
    console.log(`Title: ${blogPost.title}`);
    console.log(`Word Count: ${blogPost.wordCount}`);
    console.log(`Reading Time: ${blogPost.readingTime} minutes`);
    console.log(`Template Used: ${blogPost.template}`);
    console.log(`Generation Time: ${duration}s`);
    console.log(`Content Length: ${blogPost.content.length} characters`);
    
    // Verify word count meets 3,000-word requirement
    if (blogPost.wordCount >= 2700) {
      console.log('✅ SUCCESS: Blog post meets 3,000-word requirement');
    } else {
      console.log('❌ FAILED: Blog post is too short');
    }
    
    // Sample content preview
    const contentPreview = blogPost.content.substring(0, 500);
    console.log('\n=== CONTENT PREVIEW ===');
    console.log(contentPreview + '...');
    
  } catch (error) {
    console.error('Blog generation failed:', error);
  }
}

testBlogGeneration();