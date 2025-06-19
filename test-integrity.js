import axios from 'axios';

async function testHtmlIntegrity() {
  try {
    console.log('Testing HTML integrity system...');
    
    const response = await axios.post('http://localhost:5000/api/test-html-integrity', {
      url: 'https://synviz.com/hire-now/'
    });
    
    console.log('\n=== HTML Integrity Report ===');
    console.log(`URL: ${response.data.url}`);
    console.log(`Valid HTML: ${response.data.integrity.isValid}`);
    console.log(`Has DOCTYPE: ${response.data.integrity.hasValidDoctype}`);
    console.log(`HTML Structure: ${response.data.integrity.hasProperHtmlStructure}`);
    console.log(`Head Section: ${response.data.integrity.hasValidHead}`);
    console.log(`Body Section: ${response.data.integrity.hasValidBody}`);
    console.log(`Meta Tags: ${response.data.integrity.metaTagsCount}`);
    
    if (response.data.integrity.criticalErrors.length > 0) {
      console.log('\n🚨 Critical Errors:');
      response.data.integrity.criticalErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (response.data.integrity.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      response.data.integrity.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    console.log(`\nStructure Hash: ${response.data.integrity.structureHash.substring(0, 16)}...`);
    
    if (response.data.integrity.isValid) {
      console.log('\n✅ Page is safe for meta tag updates');
    } else {
      console.log('\n❌ Critical page - updates would be blocked');
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testHtmlIntegrity();