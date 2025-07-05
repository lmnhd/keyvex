// Debug Authentication Utility
// Centralized way to handle authentication debugging across all API routes

import { auth } from '@clerk/nextjs/server';

// Debug configuration
const DEBUG_MODE = process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH_FOR_DEBUG === 'true';
const DEBUG_USER_ID = process.env.DEBUG_USER_ID || 'debug-user-123';

export interface AuthResult {
  userId: string | null;
  isDebugMode: boolean;
}

/**
 * Centralized authentication function that handles both production and debug modes
 * @returns Promise<AuthResult> - Contains userId and debug mode flag
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  if (DEBUG_MODE) {
    console.log('🔧 DEBUG MODE: Authentication bypassed, using debug user ID:', DEBUG_USER_ID);
    return {
      userId: DEBUG_USER_ID,
      isDebugMode: true
    };
  }

  try {
    const { userId } = await auth();
    return {
      userId,
      isDebugMode: false
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      userId: null,
      isDebugMode: false
    };
  }
}

/**
 * Middleware-style function for API routes that require authentication
 * @param allowDebug - Whether to allow debug mode for this route (default: true in development)
 * @returns Promise<string> - Returns userId or throws error
 */
export async function requireAuth(allowDebug: boolean = true): Promise<string> {
  const { userId, isDebugMode } = await getAuthenticatedUser();

  if (!userId) {
    const error = new Error('Unauthorized');
    (error as any).status = 401;
    throw error;
  }

  if (isDebugMode && !allowDebug) {
    const error = new Error('Debug mode not allowed for this route');
    (error as any).status = 403;
    throw error;
  }

  return userId;
}

/**
 * Enhanced error handling for API routes
 * Wraps requireAuth with proper HTTP error responses
 */
export async function requireAuthWithErrorHandling(allowDebug: boolean = true): Promise<{ userId: string; error?: Response }> {
  try {
    const userId = await requireAuth(allowDebug);
    return { userId };
  } catch (error) {
    const status = (error as any).status || 500;
    const message = error instanceof Error ? error.message : 'Authentication failed';
    
    return {
      userId: '',
      error: new Response(
        JSON.stringify({ error: message }),
        { 
          status,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }
}

/**
 * Check if we're currently in debug mode
 */
export function isDebugMode(): boolean {
  return DEBUG_MODE;
}

/**
 * Get debug user ID
 */
export function getDebugUserId(): string {
  return DEBUG_USER_ID;
}

/**
 * Log debug information if in debug mode
 */
export function debugLog(message: string, data?: any): void {
  if (DEBUG_MODE) {
    console.log(`🔧 DEBUG: ${message}`, data || '');
  }
} 
