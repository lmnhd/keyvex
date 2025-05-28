# AI Components

This directory contains AI-powered components for the Keyvex application.

## AgentConnection

The `AgentConnection` component provides a conversational interface with dynamic UI generation for brand intelligence and tool creation assistance.

### Features

- **Conversational Interface**: Real-time chat with AI agent
- **Dynamic Component Generation**: AI generates appropriate UI components based on conversation context
- **Brand Analysis**: Visual analysis of uploaded logos and brand assets
- **Mock Mode**: Testing mode with predefined responses
- **Session State Tracking**: Monitors conversation progress and confidence levels
- **Collapsible Session Panel**: Space-efficient state monitoring

### Usage

```tsx
import { AgentConnection } from '@/components/ai/agent-connection';

function MyPage() {
  const handleAnalysisComplete = (analysis: any) => {
    console.log('Brand analysis:', analysis);
  };

  const handleToolSuggestion = (suggestion: any) => {
    console.log('Tool suggestion:', suggestion);
  };

  return (
    <AgentConnection
      title="Brand Intelligence Assistant"
      description="Get AI assistance with your brand"
      height="600px"
      showSessionState={true}
      useMockData={false}
      onAnalysisComplete={handleAnalysisComplete}
      onToolSuggestion={handleToolSuggestion}
      onStateChange={(state) => console.log('State:', state)}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | "Brand Intelligence Assistant" | Header title |
| `description` | `string` | "Interactive conversation..." | Header description |
| `height` | `string` | "700px" | Component height |
| `showSessionState` | `boolean` | `true` | Show session state panel |
| `useMockData` | `boolean` | `true` | Use mock responses for testing |
| `onAnalysisComplete` | `function` | - | Called when brand analysis completes |
| `onToolSuggestion` | `function` | - | Called when AI suggests a tool |
| `onStateChange` | `function` | - | Called when session state changes |
| `className` | `string` | "" | Additional CSS classes |

### Visual Components

The agent can generate these dynamic components:

- **FileUpload**: For uploading brand assets
- **ColorPalette**: Displays extracted brand colors
- **BrandForm**: Collects business information
- **StylePreview**: Shows brand styling preview
- **ToolSuggestions**: Presents tool recommendations

### Integration Examples

#### Main Create Page
```tsx
// Embedded in tool creation workflow
<AgentConnection
  height="500px"
  showSessionState={false}
  onToolSuggestion={(suggestion) => {
    // Apply suggestion to current tool creation
    applyToolSuggestion(suggestion);
  }}
/>
```

#### Standalone Brand Analysis
```tsx
// Dedicated brand analysis page
<AgentConnection
  title="Brand Analysis"
  description="Upload your logo for AI analysis"
  showSessionState={true}
  onAnalysisComplete={(analysis) => {
    // Store analysis results
    setBrandData(analysis);
  }}
/>
```

### Mock Data

When `useMockData={true}`, the component responds to these keywords:
- "tech", "startup", "software" → Tech brand analysis
- "consulting", "business", "professional" → Professional brand analysis
- Other inputs → Generic business form

### Dependencies

- `@/lib/ai/agents/magic-spark` - AI agent logic
- `@/components/ai/visual-components` - Dynamic UI components
- `@/components/ui/*` - Base UI components 