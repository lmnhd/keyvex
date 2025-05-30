// AI Model Testing API Route - For development and prompt testing

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { requireAuth, debugLog } from '@/lib/auth/debug';
import { MAGIC_SPARK_PROMPTS } from '@/lib/prompts/magic-spark';
import { TEST_MODEL_PROMPTS } from '@/lib/prompts/test-model-prompts';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';

// Test request schema
const testRequestSchema = z.object({
  testType: z.enum([
    'model-connection',
    'prompt-individual', 
    'ui-input-generation',
    'conversation-flow',
    'structured-output'
  ]),
  
  // Model connection test
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().optional(),
  
  // Prompt testing
  promptKey: z.string().optional(), // Key from MAGIC_SPARK_PROMPTS
  promptVariables: z.record(z.string()).optional(),
  
  // UI input generation test
  userInput: z.string().optional(),
  inputHistory: z.array(z.any()).optional(),
  
  // Test parameters
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  includeMetrics: z.boolean().default(true)
});

// Available prompts for testing
const AVAILABLE_PROMPTS = {
  'system': MAGIC_SPARK_PROMPTS.SYSTEM_PROMPT,
  'initial-suggestion': MAGIC_SPARK_PROMPTS.INITIAL_SUGGESTION,
  'refinement': MAGIC_SPARK_PROMPTS.REFINEMENT,
  'prototype-generation': MAGIC_SPARK_PROMPTS.PROTOTYPE_GENERATION,
  'feasibility-validation': MAGIC_SPARK_PROMPTS.FEASIBILITY_VALIDATION,
  'similar-examples': MAGIC_SPARK_PROMPTS.SIMILAR_EXAMPLES,
  'value-proposition': MAGIC_SPARK_PROMPTS.VALUE_PROPOSITION,
  
  // Import test model prompts from dedicated prompt file
  'ui-input-assistant': TEST_MODEL_PROMPTS['ui-input-assistant'],
  'conversation-flow-assistant': TEST_MODEL_PROMPTS['conversation-flow-assistant']
};

export async function POST(request: NextRequest) {
  try {
    // Authenticate user (debug-aware)
    const userId = await requireAuth();
    debugLog('AI Model Test API request', { userId });

    // Parse and validate request
    const body = await request.json();
    const testData = testRequestSchema.parse(body);
    
    const startTime = Date.now();
    let response: any = {};

    switch (testData.testType) {
      case 'model-connection':
        response = await testModelConnection(testData);
        break;
        
      case 'prompt-individual':
        response = await testIndividualPrompt(testData);
        break;
        
      case 'ui-input-generation':
        response = await testUIInputGeneration(testData);
        break;
        
      case 'conversation-flow':
        response = await testConversationFlow(testData);
        break;
        
      case 'structured-output':
        response = await testStructuredOutput(testData);
        break;
        
      default:
        throw new Error(`Unknown test type: ${testData.testType}`);
    }

    const endTime = Date.now();
    const metrics = testData.includeMetrics ? {
      processingTime: endTime - startTime,
      timestamp: new Date().toISOString(),
      userId,
      testType: testData.testType
    } : undefined;

    return NextResponse.json({
      success: true,
      testType: testData.testType,
      data: response,
      metrics
    });

  } catch (error) {
    console.error('AI Model Test API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    debugLog('AI Model Test API info request', { userId });

    return NextResponse.json({
      success: true,
      availableTests: [
        {
          type: 'model-connection',
          description: 'Test basic model connectivity and response',
          requiredParams: ['provider', 'model'],
          optionalParams: ['temperature', 'maxTokens']
        },
        {
          type: 'prompt-individual',
          description: 'Test individual prompts from the magic-spark agent',
          requiredParams: ['promptKey'],
          optionalParams: ['promptVariables', 'provider', 'model']
        },
        {
          type: 'ui-input-generation',
          description: 'Test UI input component generation and selection',
          requiredParams: ['userInput'],
          optionalParams: ['inputHistory']
        },
        {
          type: 'conversation-flow',
          description: 'Test conversation continuity and context awareness',
          requiredParams: ['userInput'],
          optionalParams: ['inputHistory']
        },
        {
          type: 'structured-output',
          description: 'Test structured JSON output generation',
          requiredParams: ['promptKey'],
          optionalParams: ['promptVariables']
        }
      ],
      availablePrompts: Object.keys(AVAILABLE_PROMPTS),
      availableProviders: ['openai', 'anthropic'],
      defaultModels: {
        openai: 'gpt-4-turbo-preview',
        anthropic: 'claude-3-5-sonnet-20241022'
      }
    });

  } catch (error) {
    console.error('AI Model Test API info error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get test info'
      },
      { status: 500 }
    );
  }
}

// Test basic model connection
async function testModelConnection(testData: any) {
  const provider = testData.provider || 'openai';
  const modelName = testData.model || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'claude-3-5-sonnet-20241022');
  
  let model: any;
  if (provider === 'openai') {
    model = openai(modelName);
  } else if (provider === 'anthropic') {
    model = anthropic(modelName);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const testPrompt = "Hello! This is a connection test. Please respond with a brief confirmation that you're working correctly and include your model name.";
  
  const { text } = await generateText({
    model,
    prompt: testPrompt,
    temperature: testData.temperature || 0.7,
    maxTokens: testData.maxTokens || 150
  });

  return {
    provider,
    model: modelName,
    prompt: testPrompt,
    response: text,
    status: 'connected'
  };
}

// Test individual prompts
async function testIndividualPrompt(testData: any) {
  const promptKey = testData.promptKey;
  if (!promptKey || !AVAILABLE_PROMPTS[promptKey as keyof typeof AVAILABLE_PROMPTS]) {
    throw new Error(`Invalid prompt key: ${promptKey}. Available: ${Object.keys(AVAILABLE_PROMPTS).join(', ')}`);
  }

  let prompt = AVAILABLE_PROMPTS[promptKey as keyof typeof AVAILABLE_PROMPTS];
  
  // Replace variables if provided
  if (testData.promptVariables) {
    for (const [key, value] of Object.entries(testData.promptVariables)) {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value as string);
    }
  }

  const provider = testData.provider || 'openai';
  const modelName = testData.model || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'claude-3-5-sonnet-20241022');
  
  let model: any;
  if (provider === 'openai') {
    model = openai(modelName);
  } else {
    model = anthropic(modelName);
  }

  const { text } = await generateText({
    model,
    prompt,
    temperature: testData.temperature || 0.7,
    maxTokens: testData.maxTokens || 1000
  });

  return {
    promptKey,
    provider,
    model: modelName,
    originalPrompt: AVAILABLE_PROMPTS[promptKey as keyof typeof AVAILABLE_PROMPTS],
    processedPrompt: prompt,
    variables: testData.promptVariables || {},
    response: text
  };
}

// Test UI input generation
async function testUIInputGeneration(testData: any) {
  const userInput = testData.userInput;
  const inputHistory = testData.inputHistory || [];
  
  const prompt = `${AVAILABLE_PROMPTS['ui-input-assistant']}

Current user input: "${userInput}"

Previous conversation history:
${inputHistory.length > 0 ? JSON.stringify(inputHistory, null, 2) : 'No previous history'}

Based on this input and history, generate an appropriate follow-up question with the right input component type. Respond with a JSON object containing:

{
  "question": "The question to ask the user",
  "inputType": "select|multiSelect|colorSelect|yesNoMaybe|text|textarea|multiPart",
  "reasoning": "Why you chose this input type",
  "options": [...], // If applicable for the input type
  "placeholder": "Helpful placeholder text", // If applicable
  "suggestions": [...], // If applicable for text inputs
  "maxSelections": 3, // If applicable for multiSelect
  "allowCustom": true, // If applicable for select/colorSelect
  "configuration": {} // Any additional configuration
}

Ensure the question flows naturally from the user's input and moves the tool creation process forward.`;

  const model = openai('gpt-4-turbo-preview');
  
  const questionSchema = z.object({
    question: z.string(),
    inputType: z.enum(['select', 'multiSelect', 'colorSelect', 'yesNoMaybe', 'text', 'textarea', 'multiPart']),
    reasoning: z.string(),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
      colors: z.array(z.string()).optional()
    })).optional(),
    placeholder: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
    maxSelections: z.number().optional(),
    allowCustom: z.boolean().optional(),
    configuration: z.record(z.any()).optional()
  });

  const { object } = await generateObject({
    model,
    schema: questionSchema,
    prompt,
    temperature: 0.7
  });

  return {
    userInput,
    inputHistory,
    generatedQuestion: object,
    prompt: prompt.substring(0, 200) + '...' // Truncated for response
  };
}

// Test conversation flow
async function testConversationFlow(testData: any) {
  const userInput = testData.userInput;
  const inputHistory = testData.inputHistory || [];
  
  const prompt = `${AVAILABLE_PROMPTS['conversation-flow-assistant']}

Current user input: "${userInput}"

Conversation history:
${inputHistory.length > 0 ? JSON.stringify(inputHistory, null, 2) : 'No previous history'}

Generate a natural, flowing response that:
1. Acknowledges the user's current input
2. References relevant previous conversation points
3. Suggests a logical next step
4. Maintains enthusiasm and helpfulness

Format your response as a JSON object:
{
  "response": "Natural conversational response",
  "contextReferences": ["Points from history that were referenced"],
  "suggestedNextStep": "What should happen next",
  "conversationFlow": "Assessment of flow quality",
  "improvements": ["Suggestions for better conversation flow"]
}`;

  const model = openai('gpt-4-turbo-preview');
  
  const flowSchema = z.object({
    response: z.string(),
    contextReferences: z.array(z.string()),
    suggestedNextStep: z.string(),
    conversationFlow: z.string(),
    improvements: z.array(z.string())
  });

  const { object } = await generateObject({
    model,
    schema: flowSchema,
    prompt,
    temperature: 0.7
  });

  return {
    userInput,
    inputHistory,
    flowAnalysis: object
  };
}

// Test structured output
async function testStructuredOutput(testData: any) {
  const promptKey = testData.promptKey;
  if (!promptKey || !AVAILABLE_PROMPTS[promptKey as keyof typeof AVAILABLE_PROMPTS]) {
    throw new Error(`Invalid prompt key for structured output test: ${promptKey}`);
  }

  // Use a simple schema for testing structured output
  const testSchema = z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    recommendations: z.array(z.string()),
    nextSteps: z.array(z.string())
  });

  let prompt = AVAILABLE_PROMPTS[promptKey as keyof typeof AVAILABLE_PROMPTS];
  
  // Replace variables if provided
  if (testData.promptVariables) {
    for (const [key, value] of Object.entries(testData.promptVariables)) {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value as string);
    }
  }

  prompt += "\n\nPlease structure your response according to the provided schema with summary, keyPoints, confidence level, recommendations, and nextSteps.";

  const model = openai('gpt-4-turbo-preview');
  
  const { object } = await generateObject({
    model,
    schema: testSchema,
    prompt,
    temperature: 0.7
  });

  return {
    promptKey,
    structuredOutput: object,
    schema: {
      summary: 'string',
      keyPoints: 'string[]',
      confidence: 'number (0-1)',
      recommendations: 'string[]',
      nextSteps: 'string[]'
    }
  };
} 