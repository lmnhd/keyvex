# Dark Mode Implementation

This document describes the dark mode functionality implemented in the Keyvex application.

## Overview

The dark mode implementation uses `next-themes` for seamless theme switching with support for:
- Light mode
- Dark mode  
- System preference detection
- Smooth transitions
- Hydration-safe rendering

## Components

### ThemeProvider (`src/components/theme-provider.tsx`)
Wraps the application with theme context using `next-themes`.

### ModeToggle (`src/components/mode-toggle.tsx`)
A dropdown-based theme toggle with three options:
- Light
- Dark
- System (follows OS preference)

### SimpleModeToggle (`src/components/simple-mode-toggle.tsx`)
A simpler button-based theme toggle that cycles through themes:
- Click to cycle: Light → Dark → System → Light

## Usage

### Basic Implementation
The theme provider is already configured in `src/app/layout.tsx`:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

### Adding Theme Toggle
Import and use either toggle component:

```tsx
import { ModeToggle } from "@/components/mode-toggle"
// or
import { SimpleModeToggle } from "@/components/simple-mode-toggle"

// In your component
<ModeToggle />
```

### Using Theme in Components
```tsx
import { useTheme } from "next-themes"

function MyComponent() {
  const { theme, setTheme } = useTheme()
  
  return (
    <div>
      Current theme: {theme}
      <button onClick={() => setTheme('dark')}>
        Switch to dark
      </button>
    </div>
  )
}
```

## CSS Variables

The application uses CSS custom properties for theming. All theme colors are defined in `src/app/globals.css`:

### Light Mode Variables
- `--background`: Main background color
- `--foreground`: Main text color
- `--primary`: Primary brand color
- `--secondary`: Secondary color
- `--muted`: Muted text/backgrounds
- `--accent`: Accent color
- `--border`: Border color
- And more...

### Dark Mode Variables
All variables are redefined in the `.dark` class with appropriate dark theme values.

## Tailwind Integration

The theme system integrates with Tailwind CSS classes:
- `bg-background` - Uses CSS variable `--background`
- `text-foreground` - Uses CSS variable `--foreground`
- `border-border` - Uses CSS variable `--border`
- `text-muted-foreground` - Uses CSS variable `--muted-foreground`

## Best Practices

1. **Always use semantic color classes** instead of hardcoded colors
2. **Test both themes** during development
3. **Use the `suppressHydrationWarning`** prop on the html tag to prevent hydration mismatches
4. **Handle loading states** for client-side theme detection

## Troubleshooting

### Hydration Mismatch
If you see hydration warnings, ensure:
- `suppressHydrationWarning` is set on the html tag
- Theme-dependent content is properly handled on the client side

### Theme Not Persisting
The theme preference is automatically saved to localStorage by `next-themes`.

### Custom Colors
To add custom theme colors:
1. Add CSS variables to both `:root` and `.dark` in `globals.css`
2. Add the color to your Tailwind config if needed
3. Use the semantic class names in your components

## Dependencies

- `next-themes`: Theme switching functionality
- `lucide-react`: Icons for theme toggle buttons
- `@radix-ui/react-dropdown-menu`: Dropdown component (for ModeToggle) 