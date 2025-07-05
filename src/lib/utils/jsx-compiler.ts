// Server-only JSX compilation utility
// This file should only be imported by API routes

import * as babel from '@babel/core';

/**
 * Compiles JSX component code to executable JavaScript
 * SERVER-SIDE ONLY - Do not import in client components
 */
export async function compileJSXComponent(componentCode: string): Promise<string> {
  try {
    console.log('[JSX Compiler] Compiling component code...');
    
    // Clean the code first
    const cleanedCode = componentCode
      .replace(/^['"]use client['"];?\s*/gm, '') // Remove 'use client'
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*/gm, '') // Remove import statements
      .trim();

    // Transform JSX to JavaScript using Babel
    const result = babel.transformSync(cleanedCode, {
      presets: [
        ['@babel/preset-react', {
          runtime: 'classic', // Use React.createElement instead of automatic runtime
          pragma: 'React.createElement'
        }]
      ],
      plugins: [],
      filename: 'component.tsx'
    });

    if (!result || !result.code) {
      throw new Error('Babel compilation failed - no output generated');
    }

    console.log('[JSX Compiler] ✅ Successfully compiled JSX to JavaScript');
    return result.code;

  } catch (error) {
    console.error('[JSX Compiler] ❌ Compilation failed:', error);
    throw new Error(`JSX compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 
