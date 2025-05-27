# Debug Authentication System

This document explains how to use the centralized debug authentication system in Keyvex.

## Overview

The debug authentication system allows you to bypass Clerk authentication during development and testing. This is useful for:

- API testing without setting up Clerk
- Development when Clerk is not configured
- Automated testing scenarios
- Quick prototyping

## How It Works

The system uses environment variables to control authentication behavior:

- **Production**: Always uses Clerk authentication
- **Development**: Can optionally bypass Clerk authentication when debug mode is enabled

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# Enable debug mode (only works in development)
DISABLE_AUTH_FOR_DEBUG=true

# Custom debug user ID (optional)
DEBUG_USER_ID=debug-user-123
```

### Debug Mode Activation

Debug mode is only activated when:
1. `NODE_ENV=development`
2. `DISABLE_AUTH_FOR_DEBUG=true`

This ensures debug mode never activates in production.

## Usage

### In API Routes

All API routes now use the centralized authentication utility:

```typescript
import { requireAuth, debugLog } from '@/lib/auth/debug';

export async function POST(request: NextRequest) {
  try {
    // This handles both production and debug authentication
    const userId = await requireAuth();
    
    // Optional debug logging
    debugLog('API request received', { userId });
    
    // Your API logic here...
  } catch (error) {
    // Handle authentication errors
  }
}
```

### Available Functions

#### `requireAuth(allowDebug?: boolean)`
- Returns authenticated user ID
- Throws error if not authenticated
- `allowDebug`: Whether to allow debug mode (default: true)

#### `getAuthenticatedUser()`
- Returns `{ userId, isDebugMode }` object
- More detailed authentication info

#### `isDebugMode()`
- Returns boolean indicating if debug mode is active

#### `debugLog(message, data?)`
- Logs debug information only when debug mode is active

## Security

- Debug mode only works in development (`NODE_ENV=development`)
- Production builds ignore debug environment variables
- Debug logs are clearly marked with 🔧 emoji
- All debug activity is logged to console

## Testing

### Manual Testing
1. Set `DISABLE_AUTH_FOR_DEBUG=true` in `.env.local`
2. Restart your development server
3. API calls will use the debug user ID instead of requiring Clerk authentication

### API Testing Page
Visit `/api-test` to test all API endpoints with debug authentication enabled.

### Switching Back to Production Mode
1. Set `DISABLE_AUTH_FOR_DEBUG=false` or remove the variable
2. Restart your development server
3. API calls will require proper Clerk authentication

## Routes Updated

The following routes now use the centralized debug authentication:

- `/api/ai/magic-spark`
- `/api/ai/logic-architect`
- `/api/ai/content-crafter`
- `/api/ai/style-master`
- `/api/ai/create-tool`
- `/api/tools`
- `/api/analytics` (GET and PUT only, POST is public)

## Troubleshooting

### Debug Mode Not Working
- Check that `NODE_ENV=development`
- Verify `DISABLE_AUTH_FOR_DEBUG=true` in `.env.local`
- Restart the development server
- Check console for debug logs with 🔧 emoji

### Authentication Errors in Production
- Debug mode is automatically disabled in production
- Ensure Clerk is properly configured
- Check Clerk environment variables

### Mixed Authentication States
- Clear browser cookies and local storage
- Restart the development server
- Ensure consistent environment variable settings

## Best Practices

1. **Never commit debug mode enabled** - Keep `.env.local` in `.gitignore`
2. **Use descriptive debug user IDs** - Makes debugging easier
3. **Test both modes** - Verify functionality works with and without debug mode
4. **Document debug usage** - Note when debug mode is needed for specific features
5. **Clean up debug code** - Remove debug-specific code before production deployment 