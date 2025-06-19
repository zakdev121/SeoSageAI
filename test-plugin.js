// Test the custom WordPress plugin functionality
const axios = require('axios');

const credentials = Buffer.from('SEO Audit Tool:tFX3 p1HO D1SE cqwk foBv BlUP').toString('base64');
const headers = {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json'
};

async function testCustomPlugin() {
  try {
    console.log('Testing custom WordPress plugin...');
    
    // Test 1: Get current meta data
    console.log('\n1. Fetching current meta data...');
    const getResponse = await axios.get('https://synviz.com/wp-json/wp/v2/posts/80340', { headers });
    
    const currentMeta = getResponse.data.meta;
    console.log('Current Yoast meta:');
    console.log('- Title:', currentMeta._yoast_wpseo_title);
    console.log('- Meta Description:', currentMeta._yoast_wpseo_metadesc);
    console.log('- Focus Keyword:', currentMeta._yoast_wpseo_focuskw);
    
    // Test 2: Try updating meta description
    console.log('\n2. Testing meta description update...');
    const newMetaDesc = 'UPDATED VIA API: The 5 essential qualities that make IT software companies truly elite - discover what sets industry leaders apart.';
    
    const updateResponse = await axios.post('https://synviz.com/wp-json/wp/v2/posts/80340', {
      meta: {
        '_yoast_wpseo_metadesc': newMetaDesc
      }
    }, { headers });
    
    console.log('Update response status:', updateResponse.status);
    
    // Test 3: Verify the update worked
    console.log('\n3. Verifying update...');
    const verifyResponse = await axios.get('https://synviz.com/wp-json/wp/v2/posts/80340', { headers });
    const updatedMeta = verifyResponse.data.meta._yoast_wpseo_metadesc;
    
    console.log('Updated meta description:', updatedMeta);
    console.log('Update successful:', updatedMeta === newMetaDesc);
    
  } catch (error) {
    console.error('Plugin test failed:', error.response?.data || error.message);
  }
}

testCustomPlugin();