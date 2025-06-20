/**
 * Direct test of Synviz WordPress plugin for updating meta description
 * Target page: https://synviz.com/hire-now/
 */

import axios from 'axios';

async function testHireNowMetaUpdate() {
  console.log('🎯 Testing meta description update for https://synviz.com/hire-now/\n');

  const baseUrl = 'https://synviz.com/wp-json';
  const username = process.env.WP_USERNAME;
  const password = process.env.WP_APP_PASSWORD;

  if (!username || !password) {
    console.error('❌ WordPress credentials not found in environment variables');
    console.log('Expected: WP_USERNAME and WP_APP_PASSWORD');
    return;
  }

  const authHeaders = {
    'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    'Content-Type': 'application/json'
  };

  try {
    // Step 1: Get post ID from URL
    console.log('1️⃣ Finding post ID for hire-now page...');
    
    const postsResponse = await axios.get(`${baseUrl}/wp/v2/posts?slug=hire-now`, {
      headers: authHeaders
    });

    if (postsResponse.data.length === 0) {
      // Try pages instead
      const pagesResponse = await axios.get(`${baseUrl}/wp/v2/pages?slug=hire-now`, {
        headers: authHeaders
      });
      
      if (pagesResponse.data.length === 0) {
        console.error('❌ Could not find hire-now post or page');
        return;
      }
      
      const pageId = pagesResponse.data[0].id;
      console.log(`✓ Found page ID: ${pageId}`);
      
      // Step 2: Try Synviz plugin endpoint
      console.log('\n2️⃣ Attempting Synviz plugin meta update...');
      
      const metaDescription = "Hire top-tier developers and IT professionals. Get access to skilled talent for your software projects with our comprehensive staffing solutions and technical expertise.";
      
      const synvizResponse = await axios.post(`${baseUrl}/synviz/v1/update-meta`, {
        post_id: parseInt(pageId),
        meta_description: metaDescription,
        force_update: true
      }, {
        headers: authHeaders,
        timeout: 10000
      });

      console.log('✅ Synviz plugin response:', synvizResponse.data);
      
    } else {
      const postId = postsResponse.data[0].id;
      console.log(`✓ Found post ID: ${postId}`);
      
      // Step 2: Try Synviz plugin endpoint
      console.log('\n2️⃣ Attempting Synviz plugin meta update...');
      
      const metaDescription = "Hire top-tier developers and IT professionals. Get access to skilled talent for your software projects with our comprehensive staffing solutions and technical expertise.";
      
      const synvizResponse = await axios.post(`${baseUrl}/synviz/v1/update-meta`, {
        post_id: parseInt(postId),
        meta_description: metaDescription,
        force_update: true
      }, {
        headers: authHeaders,
        timeout: 10000
      });

      console.log('✅ Synviz plugin response:', synvizResponse.data);
    }

  } catch (error) {
    console.error('❌ Error updating meta description:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n🔄 Synviz plugin not found, trying WordPress REST API fallback...');
      
      try {
        // Fallback to WordPress REST API
        const postsResponse = await axios.get(`${baseUrl}/wp/v2/posts?slug=hire-now`, {
          headers: authHeaders
        });

        if (postsResponse.data.length > 0) {
          const postId = postsResponse.data[0].id;
          
          // Update using Yoast SEO meta if available
          const updateResponse = await axios.post(`${baseUrl}/wp/v2/posts/${postId}`, {
            yoast_head_json: {
              description: "Hire top-tier developers and IT professionals. Get access to skilled talent for your software projects with our comprehensive staffing solutions and technical expertise."
            }
          }, {
            headers: authHeaders
          });

          console.log('✅ WordPress REST API fallback successful:', updateResponse.data.id);
        }
        
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError.response?.data || fallbackError.message);
      }
    }
  }
}

testHireNowMetaUpdate().catch(console.error);