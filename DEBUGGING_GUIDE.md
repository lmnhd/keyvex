# Debugging Next.js with Turbopack

This guide explains how to debug your Next.js application with Turbopack enabled, addressing the common port mapping issues that prevent breakpoints from being hit.

## The Problem

Turbopack has known issues with debugging where:
1. Breakpoints don't get hit in VS Code
2. The debugger connects to the wrong port
3. Source maps aren't properly mapped
4. The Node.js inspector protocol doesn't work as expected

## Solutions

### Option 1: Use the Configured Debug Setup (Recommended)

We've configured multiple debugging options for you:

#### Method A: VS Code Launch Configurations

1. **Set breakpoints** in your TypeScript/JavaScript files
2. **Open VS Code** and go to the Debug panel (Ctrl+Shift+D)
3. **Select one of these configurations**:
   - `Next.js: debug server-side` - For API routes and server components
   - `Next.js: debug client-side` - For client components (browser debugging)
   - `Next.js: debug full stack (Turbopack)` - Complete debugging setup
   - `Next.js: Turbopack with custom port` - If you have port conflicts

4. **Press F5** to start debugging

#### Method B: PowerShell Script (Windows)

```powershell
cd keyvex_app
.\debug-setup.ps1
```

This script automatically:
- Finds an available debug port
- Sets the correct environment variables
- Starts the dev server with debugging enabled

#### Method C: Manual NPM Scripts

```powershell
# Basic debugging (cross-platform)
npm run dev:debug

# Debug with breakpoint on start (cross-platform)
npm run dev:debug-brk

# Windows-specific debugging (if cross-env doesn't work)
npm run dev:debug-win
npm run dev:debug-brk-win

# Fallback to Webpack if Turbopack issues persist
npm run dev:webpack-debug
```

### Option 2: Manual Setup

If the automated setup doesn't work, follow these steps:

1. **Start the dev server with debugging**:
   ```powershell
   $env:NODE_OPTIONS="--inspect=127.0.0.1:9229"
   npm run dev
   ```

2. **In VS Code**:
   - Go to Debug panel
   - Select "Next.js: debug server-side"
   - Press F5

3. **If port 9229 is busy**, try a different port:
   ```powershell
   $env:NODE_OPTIONS="--inspect=127.0.0.1:9230"
   npm run dev
   ```
   Then update the port in `.vscode/launch.json`

### Option 3: Fallback to Webpack

If Turbopack debugging continues to be problematic:

1. **Use Webpack instead**:
   ```powershell
   npm run dev:webpack-debug
   ```

2. **Or modify your dev script temporarily**:
   ```json
   "dev": "next dev"  // Remove --turbopack
   ```

## Debugging Different Parts of Your App

### API Routes (Server-side)
- Use `Next.js: debug server-side` configuration
- Set breakpoints in files like `src/app/api/ai/magic-spark/route.ts`
- The debugger will pause on server-side code execution

### React Components (Client-side)
- Use `Next.js: debug client-side` configuration
- Set breakpoints in your React components
- This opens Chrome DevTools for client-side debugging

### Server Components
- Use `Next.js: debug server-side` configuration
- Server components run on the server, so they're debugged like API routes

## Troubleshooting

### Breakpoints Not Hit

1. **Check source maps**: Ensure your `next.config.ts` has the correct source map configuration
2. **Verify file paths**: Make sure VS Code is opening files from the correct workspace
3. **Clear cache**: Delete `.next` folder and restart
4. **Check port**: Ensure the debugger is connecting to the right port

### Port Conflicts

If you get "port already in use" errors:

1. **Find what's using the port**:
   ```powershell
   netstat -ano | findstr :9229
   ```

2. **Kill the process** (replace PID with actual process ID):
   ```powershell
   taskkill /PID <PID> /F
   ```

3. **Or use a different port** in your configuration

### Source Map Issues

If breakpoints are set but not hit:

1. **Check source map paths** in `.vscode/settings.json`
2. **Verify the `resolveSourceMapLocations`** in launch configurations
3. **Try different source map types** in `next.config.ts`

## Environment Variables

These environment variables can help with debugging:

```powershell
# Enable Node.js debugging
$env:NODE_OPTIONS="--inspect=127.0.0.1:9229"

# Enable Next.js debug mode
$env:NEXT_DEBUG="1"

# Enable verbose logging
$env:DEBUG="*"
```

## VS Code Extensions

Recommended extensions for better debugging:

- **JavaScript Debugger** (built-in)
- **TypeScript Importer**
- **Error Lens**
- **Thunder Client** (for API testing)

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Breakpoints grayed out | Check if source maps are enabled and file paths are correct |
| "Cannot connect to runtime" | Verify the debug port and ensure the server is running |
| Breakpoints in wrong files | Clear VS Code workspace cache and reload |
| Slow debugging | Use `skipFiles` configuration to exclude node_modules |

## Testing Your Setup

1. **Set a breakpoint** in `src/app/api/ai/magic-spark/route.ts` at line 45
2. **Start debugging** with "Next.js: debug server-side"
3. **Make a request** to the API endpoint
4. **Verify** the breakpoint is hit

If this works, your debugging setup is correct!

## Need Help?

If you're still having issues:

1. Check the VS Code Debug Console for error messages
2. Try the Webpack fallback option
3. Verify your Node.js version is compatible (16.8+)
4. Consider using `console.log` statements as a temporary debugging method 