# Logging Configuration Guide

## Overview

This project uses **Pino** for structured logging in AI agent processes. The logging system is designed to be **non-intrusive** for regular development work while providing detailed insights when debugging AI operations.

## Current Setup

### Default Behavior (AI_DEBUG=false or unset)
- ✅ **Clean console output** - AWS deployments, npm scripts, and other tools work normally
- ✅ **File logging** - All AI logs are saved to `app.log` in JSON format
- ✅ **No console interference** - Standard console.log, process output works as expected

### AI Debug Mode (AI_DEBUG=true)
- 🎨 **Pretty formatted logs** in console with emojis and colors
- 📊 **Structured metadata** display
- ⚠️ **May interfere** with other console output (AWS deployments, etc.)

## Quick Commands

### Using PowerShell Script (Recommended)

```powershell
# Disable AI debugging (default - for clean AWS deploys)
.\scripts\toggle-ai-debug.ps1 -Off

# Enable AI debugging (when working on AI features)
.\scripts\toggle-ai-debug.ps1 -On

# Check current status
.\scripts\toggle-ai-debug.ps1 -Status
```

### Manual Environment Variable Control

```powershell
# In .env.local file, add:
AI_DEBUG=false  # Clean console output
AI_DEBUG=true   # Pretty AI logs in console
```

## When to Use Each Mode

### Use AI_DEBUG=false when:
- 🚀 **Deploying to AWS** - Need clean console output to see deployment status
- 🔧 **Running npm scripts** - Want to see normal build/test output
- 🐛 **Debugging non-AI issues** - Need standard console behavior
- 📝 **General development** - Clean terminal experience

### Use AI_DEBUG=true when:
- 🤖 **Debugging AI agents** - Need to see detailed AI processing logs
- 📊 **Analyzing AI workflows** - Want structured log output with metadata
- 🔍 **Troubleshooting AI issues** - Need real-time AI log visibility

## Log Files

- **app.log** - Always contains JSON formatted logs (in development)
- Located in project root: `keyvex_app/app.log`
- Includes all AI agent activity, API calls, and processing steps

## Integration with AI Agents

All AI agent files import the logger:

```typescript
import logger from '@/lib/logger';

// Usage in AI agents
logger.info('Processing user request', { userId, toolType });
logger.debug('Agent response', { agentName, response });
logger.error('AI processing failed', { error: error.message });
```

## Best Practices

1. **Default to OFF** - Keep `AI_DEBUG=false` for normal development
2. **Toggle ON** only when debugging AI-specific issues
3. **Check logs in file** - Use `app.log` for historical AI activity
4. **Clean deploys** - Always disable before AWS operations

## Troubleshooting

### Problem: AWS deployment logs not showing
**Solution:** Run `.\scripts\toggle-ai-debug.ps1 -Off`

### Problem: Can't see AI processing details
**Solution:** Run `.\scripts\toggle-ai-debug.ps1 -On`

### Problem: Console output is garbled
**Solution:** Disable AI debug mode and restart your terminal

---

This setup gives you the best of both worlds: detailed AI logging when you need it, and clean console output when you don't. 