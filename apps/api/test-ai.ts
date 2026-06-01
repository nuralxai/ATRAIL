import { chat } from './src/modules/ai/ai.service.js';

async function testAI() {
  console.log('Sending message to NVIDIA AI API...');
  console.log('---');
  
  try {
    const response = await chat([
      { role: 'user', content: 'Say hello world and introduce yourself as the ATRAIL AI powered by NVIDIA short and sweet.' }
    ]);
    
    console.log('Response from NVIDIA API:');
    console.log(response);
    console.log('---');
    console.log('✅ NVIDIA AI API test successful!');
  } catch (err) {
    console.error('❌ Failed to test AI API:');
    console.error(err);
  }
}

testAI();
