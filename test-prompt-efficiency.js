// Quick test to demonstrate prompt efficiency
// Run with: node test-prompt-efficiency.js

const { buildToolCreationSystemPrompt } = require('./src/lib/prompts/tool-creation-prompt-modular.ts');

function approximateTokenCount(text) {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

console.log('🧪 PROMPT EFFICIENCY TEST\n');

// Test different configurations
const configs = [
  {
    name: 'Basic Tool (default)',
    options: {}
  },
  {
    name: 'Premium Healthcare Tool',
    options: {
      includeComprehensiveColors: true,
      includeGorgeousStyling: true,
      styleComplexity: 'premium',
      industryFocus: 'healthcare'
    }
  },
  {
    name: 'Complex Financial Calculator',
    options: {
      includeComprehensiveColors: true,
      includeGorgeousStyling: true,
      includeAdvancedLayouts: true,
      styleComplexity: 'premium',
      toolComplexity: 'complex'
    }
  },
  {
    name: 'Simple Business Tool',
    options: {
      styleComplexity: 'basic',
      toolComplexity: 'simple'
    }
  }
];

configs.forEach(config => {
  const prompt = buildToolCreationSystemPrompt(config.options);
  const tokenCount = approximateTokenCount(prompt);
  
  console.log(`📊 ${config.name}:`);
  console.log(`   Length: ${prompt.length} chars`);
  console.log(`   Est. Tokens: ${tokenCount}`);
  console.log(`   Options: ${JSON.stringify(config.options)}\n`);
});

console.log('✅ This demonstrates how we can target token usage based on tool complexity!');
console.log('💡 Complex tools get comprehensive guidance, simple tools stay lean.'); 