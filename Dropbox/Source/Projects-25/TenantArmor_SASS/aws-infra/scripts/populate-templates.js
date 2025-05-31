const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs').promises;
const path = require('path');

/**
 * Template Population Script for TenantArmor
 * 
 * Reads template files from documents/legal-templates-source/ and populates
 * the DynamoDB PROMPTS_TABLE with eviction response templates for batch processing.
 * 
 * Usage: node scripts/populate-templates.js
 */

class TemplatePopulator {
  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(this.dynamoClient);
    this.promptsTableName = process.env.PROMPTS_TABLE_NAME || 'TenantArmor-Prompts-Dev';
    this.templatesDir = path.join(__dirname, '..', '..', 'documents', 'legal-templates-source');
  }

  async populateAllTemplates() {
    console.log('🚀 Starting template population...');
    console.log(`📁 Reading templates from: ${this.templatesDir}`);
    console.log(`🗄️  Target DynamoDB table: ${this.promptsTableName}`);
    
    try {
      const states = await this.getAvailableStates();
      console.log(`📍 Found states: ${states.join(', ')}`);
      
      const allTemplates = [];
      
      for (const state of states) {
        const stateTemplates = await this.processStateTemplates(state);
        allTemplates.push(...stateTemplates);
      }
      
      console.log(`📝 Total templates to insert: ${allTemplates.length}`);
      
      // Insert templates in batches (DynamoDB BatchWrite limit is 25 items)
      await this.batchInsertTemplates(allTemplates);
      
      console.log('✅ Template population completed successfully!');
      console.log('\n📊 Summary:');
      this.printSummary(allTemplates);
      
    } catch (error) {
      console.error('❌ Error during template population:', error);
      throw error;
    }
  }

  async getAvailableStates() {
    const entries = await fs.readdir(this.templatesDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => name.match(/^[A-Z]{2}$/)); // Only state abbreviations like CA, NY, TX
  }

  async processStateTemplates(state) {
    console.log(`\n🏛️  Processing ${state} templates...`);
    const stateDir = path.join(this.templatesDir, state);
    const templates = [];
    
    try {
      const reasonDirs = await fs.readdir(stateDir, { withFileTypes: true });
      
      for (const reasonEntry of reasonDirs) {
        if (reasonEntry.isDirectory()) {
          const reason = reasonEntry.name;
          console.log(`  📋 Processing ${state}/${reason}...`);
          
          const reasonTemplates = await this.processReasonTemplates(state, reason);
          templates.push(...reasonTemplates);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️  Warning: Could not process ${state} templates:`, error.message);
    }
    
    return templates;
  }

  async processReasonTemplates(state, reason) {
    const reasonDir = path.join(this.templatesDir, state, reason);
    const templates = [];
    
    try {
      // Check for response.txt
      const responsePath = path.join(reasonDir, 'response.txt');
      const responseExists = await this.fileExists(responsePath);
      
      if (responseExists) {
        const responseContent = await fs.readFile(responsePath, 'utf-8');
        templates.push({
          promptType: `eviction_template_${state}_${reason}_response`,
          version: 'active',
          templateType: 'response',
          state,
          reason,
          content: responseContent.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true
        });
        console.log(`    ✅ Loaded response template: ${state}/${reason}`);
      }
      
      // Check for meta.json
      const metaPath = path.join(reasonDir, 'meta.json');
      const metaExists = await this.fileExists(metaPath);
      
      if (metaExists) {
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        const metaData = JSON.parse(metaContent);
        
        templates.push({
          promptType: `eviction_template_${state}_${reason}_meta`,
          version: 'active',
          templateType: 'meta',
          state,
          reason,
          content: '', // Meta templates store data in metadata field
          metadata: JSON.stringify(metaData),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true
        });
        console.log(`    ✅ Loaded meta template: ${state}/${reason}`);
      }
      
    } catch (error) {
      console.error(`    ❌ Error processing ${state}/${reason}:`, error.message);
    }
    
    return templates;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async batchInsertTemplates(templates) {
    console.log('\n💾 Inserting templates into DynamoDB...');
    
    // Split into batches of 25 (DynamoDB limit)
    const batchSize = 25;
    const batches = [];
    
    for (let i = 0; i < templates.length; i += batchSize) {
      batches.push(templates.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  📦 Batch ${i + 1}/${batches.length} (${batch.length} items)...`);
      
      try {
        // Try batch write first
        await this.batchWriteItems(batch);
        console.log(`    ✅ Batch ${i + 1} completed`);
      } catch (error) {
        console.warn(`    ⚠️  Batch write failed, falling back to individual inserts...`);
        await this.individualInsertItems(batch);
      }
    }
  }

  async batchWriteItems(items) {
    const putRequests = items.map(item => ({
      PutRequest: {
        Item: item
      }
    }));
    
    const command = new BatchWriteCommand({
      RequestItems: {
        [this.promptsTableName]: putRequests
      }
    });
    
    await this.docClient.send(command);
  }

  async individualInsertItems(items) {
    for (const item of items) {
      try {
        const command = new PutCommand({
          TableName: this.promptsTableName,
          Item: item
        });
        
        await this.docClient.send(command);
        console.log(`      ✅ Inserted: ${item.promptType}`);
      } catch (error) {
        console.error(`      ❌ Failed to insert ${item.promptType}:`, error.message);
      }
    }
  }

  printSummary(templates) {
    const byState = {};
    const byReason = {};
    const byType = {};
    
    templates.forEach(template => {
      // Count by state
      byState[template.state] = (byState[template.state] || 0) + 1;
      
      // Count by reason
      byReason[template.reason] = (byReason[template.reason] || 0) + 1;
      
      // Count by type
      byType[template.templateType] = (byType[template.templateType] || 0) + 1;
    });
    
    console.log('\n📊 Templates by State:');
    Object.entries(byState).forEach(([state, count]) => {
      console.log(`  ${state}: ${count} templates`);
    });
    
    console.log('\n📊 Templates by Reason:');
    Object.entries(byReason).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count} templates`);
    });
    
    console.log('\n📊 Templates by Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} templates`);
    });
  }
}

// CLI execution
async function main() {
  if (!process.env.PROMPTS_TABLE_NAME) {
    console.warn('⚠️  PROMPTS_TABLE_NAME not set, using default: TenantArmor-Prompts-Dev');
  }
  
  console.log('🎯 TenantArmor Template Population Script');
  console.log('==========================================\n');
  
  const populator = new TemplatePopulator();
  
  try {
    await populator.populateAllTemplates();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = TemplatePopulator; 