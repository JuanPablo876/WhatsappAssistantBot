# Performance Optimizer Skill

Implements high-impact performance optimizations for React/Vite applications, achieving 80%+ reduction in initial bundle size through code splitting, lazy loading, and intelligent chunking.

## Usage

Say: "Optimize performance of my React app" or "Reduce bundle size"

## What This Skill Does

### 1. Code Splitting & Lazy Loading (80% Impact)
- Converts all routes to lazy-loaded components using React.lazy()
- Implements Suspense boundaries with loading states
- Creates reusable LoadingSpinner component with dark mode support

**Before:**
```javascript
import Dashboard from "./pages/Dashboard";
import Transacciones from "./pages/Transacciones";
```

**After:**
```javascript
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transacciones = lazy(() => import("./pages/Transacciones"));
```

### 2. Smart Bundle Chunking
Configures Vite to split bundles intelligently:

```javascript
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'supabase': ['@supabase/supabase-js'],
        'validation': ['yup', 'dompurify', 'sqlstring'],
        'charts': ['recharts']
      }
    }
  }
}
```

### 3. Tree Shaking Configuration
Enables aggressive dead code elimination:

```javascript
treeshake: {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
  tryCatchDeoptimization: false
}
```

### 4. Bundle Analysis
Adds visualization to identify optimization opportunities:

```javascript
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({
    open: true,
    gzipSize: true,
    brotliSize: true
  })
]
```

## Files Modified

1. **src/App.jsx** - Implements lazy loading for all routes
2. **src/components/LoadingSpinner.jsx** - Creates loading component
3. **vite.config.js** - Adds optimization configuration
4. **package.json** - Adds build:analyze script

## Expected Results

- **Initial bundle:** 80%+ reduction (e.g., 847KB → 162KB)
- **Route chunks:** Load on-demand (7-304KB per route)
- **Vendor chunks:** Cached long-term
- **Build analysis:** Visual bundle breakdown

## Prerequisites

- React 18+ with React Router
- Vite as build tool
- Existing routing structure

## Installation

```bash
npm install --save-dev rollup-plugin-visualizer
```

## Verification

```bash
npm run build         # Check chunk sizes
npm run build:analyze # Open bundle visualization
```

## LoadingSpinner Component

```javascript
import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-darkblack-700">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
```

## Success Metrics

- First Contentful Paint: 40% improvement
- Time to Interactive: 50% improvement
- Lighthouse Performance: 15-25 point increase
- Mobile load time: 60% faster on 3G

## Common Issues

1. **Missing exports:** Ensure all lazy-loaded components have default exports
2. **Suspense boundaries:** Wrap lazy components with Suspense
3. **Error boundaries:** Add ErrorBoundary to catch loading failures
4. **TypeScript:** Use `lazy<ComponentType<Props>>()`

## Next Steps

After optimization, consider:
- Service Worker for offline support
- Resource hints (prefetch/preload)
- Image optimization (WebP conversion)
- CDN deployment for static assets