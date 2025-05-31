#!/usr/bin/env node

/**
 * Script to manage AI prompts in DynamoDB
 * Usage:
 *   node manage-prompts.js list
 *   node manage-prompts.js get lease-analysis-system active
 *   node manage-prompts.js set lease-analysis-system active "Your prompt text here"
 *   node manage-prompts.js update lease-analysis-system active "Updated prompt text"
 */

// TODO: Production - Add category-based prompt management for eviction responses
// TODO: Production - Add these commands:
//   - list-category <lease|eviction>
//   - seed-eviction-defaults  
//   - backup-category <category>
//   - validate <promptType>
//   - bulk-update <category> <file.json>

// TODO: Production - Define prompt categories for better organization
// const PROMPT_CATEGORIES = {
//   lease: ['lease-analysis-system', 'lease-analysis-user'],
//   eviction: ['eviction-vision-extraction', 'eviction-legal-analysis', 'eviction-pdf-extraction', 'eviction-template-selection']
// };

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const PROMPTS_TABLE_NAME = 'TenantArmorStack-AIPrompts'; // Update this if your table name is different

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function listPrompts() {
  try {
    const command = new ScanCommand({
      TableName: PROMPTS_TABLE_NAME
    });
    
    const result = await docClient.send(command);
    
    console.log('\n📋 Current Prompts:');
    console.log('==================');
    
    if (result.Items && result.Items.length > 0) {
      result.Items.forEach(item => {
        console.log(`\n🔹 ${item.promptType} (v${item.version})`);
        console.log(`   Active: ${item.isActive ? '✅' : '❌'}`);
        console.log(`   Created: ${item.createdAt}`);
        console.log(`   Updated: ${item.updatedAt}`);
        console.log(`   Text: ${item.promptText.substring(0, 100)}...`);
      });
    } else {
      console.log('No prompts found. Use "set" command to create one.');
    }
  } catch (error) {
    console.error('❌ Error listing prompts:', error.message);
  }
}

async function getPrompt(promptType, version) {
  try {
    const command = new GetCommand({
      TableName: PROMPTS_TABLE_NAME,
      Key: {
        promptType,
        version
      }
    });
    
    const result = await docClient.send(command);
    
    if (result.Item) {
      console.log(`\n📄 Prompt: ${promptType} (v${version})`);
      console.log('==========================================');
      console.log(result.Item.promptText);
      console.log(`\nActive: ${result.Item.isActive ? '✅' : '❌'}`);
      console.log(`Created: ${result.Item.createdAt}`);
      console.log(`Updated: ${result.Item.updatedAt}`);
    } else {
      console.log(`❌ Prompt not found: ${promptType} (v${version})`);
    }
  } catch (error) {
    console.error('❌ Error getting prompt:', error.message);
  }
}

async function setPrompt(promptType, version, promptText, isUpdate = false) {
  try {
    const now = new Date().toISOString();
    
    const item = {
      promptType,
      version,
      promptText,
      isActive: true,
      updatedAt: now
    };
    
    if (!isUpdate) {
      item.createdAt = now;
    }
    
    const command = new PutCommand({
      TableName: PROMPTS_TABLE_NAME,
      Item: item
    });
    
    await docClient.send(command);
    
    console.log(`✅ ${isUpdate ? 'Updated' : 'Created'} prompt: ${promptType} (v${version})`);
    console.log(`Text length: ${promptText.length} characters`);
  } catch (error) {
    console.error(`❌ Error ${isUpdate ? 'updating' : 'creating'} prompt:`, error.message);
  }
}

async function createDefaultPrompts() {
  const defaults = [
    {
      promptType: 'lease-analysis-system',
      version: 'active',
      promptText: `You are a legal expert specializing in residential lease agreements. 
Analyze the provided lease document and identify key terms, potential issues, and tenant rights.
Provide clear, actionable insights for the tenant.

Focus on:
- Rent terms and payment obligations
- Security deposits and fees
- Lease duration and renewal terms
- Maintenance and repair responsibilities
- Pet policies and restrictions
- Subletting and assignment rights
- Early termination clauses
- Landlord entry rights
- Potential unfair or unusual clauses

Provide analysis that is specific to the state jurisdiction when provided.`
    },
    {
      promptType: 'lease-analysis-user',
      version: 'active',
      promptText: `Please analyze this lease document text and provide a comprehensive analysis:

REQUIREMENTS:
1. Key lease terms (rent amount, duration, deposits, fees)
2. Tenant rights and responsibilities  
3. Landlord obligations and responsibilities
4. Potential red flags or concerning clauses
5. State-specific legal considerations (when applicable)
6. Actionable recommendations for the tenant

FORMAT YOUR RESPONSE AS VALID JSON matching the expected schema.

Lease text: {leaseText}
State: {userSelectedState}

Please be thorough but concise, focusing on the most important aspects that could affect the tenant.`
    },
    // TODO: Production - Add default eviction prompts here
    // {
    //   promptType: 'eviction-vision-extraction',
    //   version: 'active',
    //   promptText: 'You are an expert paralegal...'
    // },
    // {
    //   promptType: 'eviction-legal-analysis', 
    //   version: 'active',
    //   promptText: 'Analyze this eviction notice for tenant rights...'
    // },
    // {
    //   promptType: 'eviction-pdf-extraction',
    //   version: 'active', 
    //   promptText: 'Extract structured data from eviction notice text...'
    // }
  ];
  
  console.log('🔧 Creating default prompts...');
  
  for (const prompt of defaults) {
    await setPrompt(prompt.promptType, prompt.version, prompt.promptText);
  }
  
  console.log('✅ Default prompts created successfully!');
}

// Command line interface
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  console.log('🤖 TenantArmor AI Prompts Manager');
  console.log('================================\n');
  
  switch (command) {
    case 'list':
      await listPrompts();
      break;
      
    case 'get':
      if (args.length !== 2) {
        console.log('Usage: node manage-prompts.js get <promptType> <version>');
        console.log('Example: node manage-prompts.js get lease-analysis-system active');
        return;
      }
      await getPrompt(args[0], args[1]);
      break;
      
    case 'set':
      if (args.length !== 3) {
        console.log('Usage: node manage-prompts.js set <promptType> <version> "<promptText>"');
        console.log('Example: node manage-prompts.js set lease-analysis-system active "Your prompt here"');
        return;
      }
      await setPrompt(args[0], args[1], args[2]);
      break;
      
    case 'update':
      if (args.length !== 3) {
        console.log('Usage: node manage-prompts.js update <promptType> <version> "<promptText>"');
        return;
      }
      await setPrompt(args[0], args[1], args[2], true);
      break;
      
    case 'init':
      await createDefaultPrompts();
      break;
      
    // TODO: Production - Add these case statements for eviction prompt management:
    // case 'list-category':
    //   if (args.length !== 1) {
    //     console.log('Usage: node manage-prompts.js list-category <lease|eviction>');
    //     return;
    //   }
    //   await listPromptsByCategory(args[0]);
    //   break;
    //
    // case 'seed-eviction-defaults':
    //   await createEvictionDefaultPrompts();
    //   break;
    //
    // case 'backup-category':
    //   if (args.length !== 1) {
    //     console.log('Usage: node manage-prompts.js backup-category <category>');
    //     return;
    //   }
    //   await backupPromptCategory(args[0]);
    //   break;
    //
    // case 'validate':
    //   if (args.length !== 1) {
    //     console.log('Usage: node manage-prompts.js validate <promptType>');
    //     return;
    //   }
    //   await validatePrompt(args[0]);
    //   break;
      
    default:
      console.log('Available commands:');
      console.log('  list                                          - List all prompts');
      console.log('  get <promptType> <version>                   - Get a specific prompt');
      console.log('  set <promptType> <version> "<promptText>"    - Create a new prompt');
      console.log('  update <promptType> <version> "<promptText>" - Update existing prompt');
      console.log('  init                                         - Create default prompts');
      console.log('\nExamples:');
      console.log('  node manage-prompts.js list');
      console.log('  node manage-prompts.js get lease-analysis-system active');
      console.log('  node manage-prompts.js init');
  }
}

main().catch(console.error); 