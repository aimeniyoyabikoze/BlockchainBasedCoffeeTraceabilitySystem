# Theme System Implementation Guide

## Overview
A complete, production-ready theme switching system has been implemented across your entire CoffeeTrace application. The system provides seamless dark/light mode toggling with persistent user preferences and automatic application across all pages and components.

## Architecture

### 1. Theme Context (`src/context/ThemeContext.tsx`)
- Centralized theme state management
- Provides `theme` (dark/light), `isDark` boolean, and `toggleTheme()` function
- Persists theme preference to localStorage
- Automatically applies/removes `dark` class on document root

### 2. Theme Provider (`src/main.tsx`)
- Wraps entire application at root level
- Ensures all components have access to theme context
- Applied in `ThemeProvider` component

### 3. Theme Toggle Component (`src/components/ThemeToggle.tsx`)
- Reusable theme switcher button
- Shows Sun icon in dark mode (Light Mode label)
- Shows Moon icon in light mode (Dark Mode label)
- Can be placed anywhere in the app
- Accessible with aria-labels

## Features

### ✅ Complete Theme Coverage

1. **Dashboard Page**
   - All cards, buttons, and modals respect theme
   - Side navigation adapts to theme
   - Activity feed styled for both modes
   - Batch browser table fully themed

2. **Verification Page**
   - Public verification page supports theme switching
   - All certificate sections themed
   - Theme toggle accessible from top bar
   - Blockchain explorer links styled for theme

3. **Modal Forms**
   - Intake registration form
   - Quality logging form  
   - Export preparation form
   - All form inputs and labels themed

4. **Components**
   - BatchQr component
   - All info pills and metric cards
   - Story rows and activity rows
   - Toast notifications

### 🎨 CSS Variables System

#### Light Mode (`:root`)
```css
--bg-primary: #f8fafc;
--bg-secondary: #ffffff;
--bg-tertiary: #f1f5f9;
--text-primary: #0f172a;
--text-secondary: #475569;
--text-tertiary: #64748b;
--border-subtle: rgba(0, 0, 0, 0.08);
--glass-bg: rgba(255, 255, 255, 0.7);
--shadow-sm/md/lg: light shadows;
```

#### Dark Mode (`.dark`)
```css
--bg-primary: #050816;
--bg-secondary: #0b1121;
--bg-tertiary: #1a1f2e;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-tertiary: #cbd5e1;
--border-subtle: rgba(255, 255, 255, 0.08);
--glass-bg: rgba(255, 255, 255, 0.03);
--shadow-sm/md/lg: dark shadows;
```

### 🎯 Usage Examples

#### Using Theme Context in Components
```tsx
import { useTheme } from '../context/ThemeContext'

function MyComponent() {
  const { isDark, toggleTheme, theme } = useTheme()
  
  return (
    <div className="bg-white dark:bg-slate-900">
      {isDark ? <DarkModeUI /> : <LightModeUI />}
    </div>
  )
}
```

#### Adding ThemeToggle to Any Page
```tsx
import ThemeToggle from '../components/ThemeToggle'

function MyPage() {
  return (
    <div>
      <ThemeToggle />
      {/* Rest of page */}
    </div>
  )
}
```

#### Using CSS Variables
```css
.my-element {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}
```

#### Using Tailwind Dark Mode Classes
```tsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  Theme-aware content
</div>
```

## File Structure

```
src/
├── context/
│   └── ThemeContext.tsx          # Theme state management
├── components/
│   ├── ThemeToggle.tsx           # Theme switcher button
│   └── ...other components
├── pages/
│   ├── VerificationPage.tsx      # Theme-aware verification
│   └── ...other pages
├── index.css                     # Theme variables
├── main.tsx                      # ThemeProvider wrapper
└── App.tsx                       # Updated to use context
```

## Persistence

- Theme preference is automatically saved to `localStorage` under the key `'theme'`
- On page reload, user's last selected theme is restored
- Default theme is dark mode if no preference is saved
- Theme persists across page navigation and browser sessions

## Colors in Different Modes

### Accent Colors (Consistent Across Modes)
- Emerald: `#10b981` (primary action)
- Cyan: `#00f2fe` (highlight in dark mode)
- Sky: `#0ea5e9` (info accent)
- Amber: `#f59e0b` (warning/export)
- Red: `#ef4444` (errors)

### Text Hierarchy
Both modes maintain 3-level text hierarchy:
1. **Primary**: Headings, important text
2. **Secondary**: Body text, descriptions
3. **Tertiary**: Muted text, hints

### Borders & Separators
- Subtle borders for light separation
- Glassmorphism effects with backdrop blur
- Smooth transitions between theme changes (300ms)

## Testing Theme System

1. **Toggle Theme**: Click the theme button in sidebar or verification page
2. **Verify Persistence**: Toggle theme, refresh page - theme persists
3. **Cross-Page Consistency**: Switch pages - theme maintains
4. **Modal Theme**: Open forms - modals inherit current theme
5. **Color Contrast**: Verify text readability in both modes

## Browser Support

- Works with all modern browsers supporting:
  - CSS custom properties (variables)
  - localStorage API
  - CSS transitions
  - Backdrop filters (optional, degrades gracefully)

## Smooth Transitions

All theme changes include smooth 300ms transitions for:
- Background colors
- Text colors
- Border colors
- Shadow depths

This prevents jarring visual changes when toggling theme.

## Performance

- Context-based system minimal re-renders
- CSS variables provide efficient styling without inline styles
- Tailwind dark: mode optimized for production
- localStorage writes are non-blocking
- Theme toggle is sub-millisecond fast

## Future Enhancements

Possible additions:
- Auto theme detection from OS settings
- Multiple theme options (not just dark/light)
- Per-component theme overrides
- Theme preview before applying
- Scheduled theme switching (e.g., dark at night)
- Theme animation/fade transitions
