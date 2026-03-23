/**
 * Test script for External AI APIs
 * Run with: npx tsx scripts/test-external-ai.ts
 */

import * as dotenv from 'dotenv';
import { callExternalAI, isExternalAIAvailable } from '../src/lib/ai/external-client';

// Load environment variables
dotenv.config({ path: '.env' });

async function testExternalAI() {
  console.log('🧪 Testing External AI APIs...\n');

  // Debug: Check environment variables
  console.log('🔍 Environment variables:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   GOOGLE_AI_API_KEY: ${process.env.GOOGLE_AI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   AI_ENABLED: ${process.env.AI_ENABLED}`);
  console.log(`   AI_PROVIDER: ${process.env.AI_PROVIDER}\n`);

  // Check availability
  const available = await isExternalAIAvailable();
  console.log(`📡 External AI Available: ${available ? '✅' : '❌'}\n`);

  if (!available) {
    console.log('❌ No API keys configured. Please set one of:');
    console.log('   - OPENAI_API_KEY');
    console.log('   - ANTHROPIC_API_KEY');
    console.log('   - GOOGLE_AI_API_KEY');
    console.log('\n💡 Get free API keys at:');
    console.log('   - OpenAI: https://platform.openai.com/api-keys');
    console.log('   - Anthropic: https://console.anthropic.com/');
    console.log('   - Google: https://makersuite.google.com/app/apikey');
    return;
  }

  // Test chat
  console.log('💬 Testing chat functionality...');
  try {
    const response = await callExternalAI({
      message: 'Bonjour, pouvez-vous m\'aider avec la gestion scolaire?',
      role: 'TEACHER',
      language: 'fr',
    });

    if (response.success) {
      console.log('✅ Chat successful!');
      console.log(`🤖 Provider: ${response.provider}`);
      console.log(`💬 Response: ${response.response.substring(0, 200)}...`);
    } else {
      console.log('❌ Chat failed');
    }
  } catch (error) {
    console.log('❌ Chat error:', error);
  }
}

// Run test
testExternalAI().catch(console.error);