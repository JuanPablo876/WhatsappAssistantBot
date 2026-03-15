# Next.js Optimizer Skill

Implements performance, security, and best practice optimizations for Next.js 13+ App Router applications.

## Usage

Say: "Optimize my Next.js app" or "Add security headers to Next.js"

## What This Skill Does

### 1. Security Headers Configuration

Add comprehensive security headers to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 2. Image Optimization

Configure remote image patterns:

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.example.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
};
```

### 3. Bundle Analyzer Setup

Install and configure for bundle analysis:

```bash
npm install @next/bundle-analyzer
```

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
```

```json
// package.json scripts
{
  "analyze": "ANALYZE=true next build"
}
```

### 4. Dynamic Imports for Code Splitting

Convert heavy components to dynamic imports:

```typescript
// Before
import HeavyChart from '@/components/HeavyChart';

// After
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Disable SSR for client-only components
});
```

### 5. Route Segment Config

Add caching and revalidation configs to route handlers:

```typescript
// app/api/data/route.ts

// Static generation with revalidation
export const revalidate = 3600; // Revalidate every hour

// Or force dynamic
export const dynamic = 'force-dynamic';

// Or force static
export const dynamic = 'force-static';
```

### 6. Metadata Optimization

Implement proper metadata for SEO:

```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: 'Site Title',
    template: '%s | Site Title',
  },
  description: 'Site description',
  openGraph: {
    title: 'Site Title',
    description: 'Site description',
    type: 'website',
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### 7. Error Boundary Implementation

Create error handling components:

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white"
      >
        Try again
      </button>
    </div>
  );
}
```

```typescript
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### 8. Loading States

Add loading UI for better UX:

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}
```

### 9. Not Found Handling

Custom 404 pages:

```typescript
// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Page Not Found</h2>
      <Link href="/" className="mt-4 text-blue-500 hover:underline">
        Go back home
      </Link>
    </div>
  );
}
```

### 10. Middleware for Auth & Redirects

Create middleware for route protection:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard');

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
```

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `next.config.js` | Security headers, image optimization |
| `app/error.tsx` | Route-level error boundary |
| `app/global-error.tsx` | App-level error boundary |
| `app/loading.tsx` | Loading states |
| `app/not-found.tsx` | 404 handling |
| `middleware.ts` | Auth and redirects |

## Verification Checklist

- [ ] Security headers present (check with `curl -I https://your-site.com`)
- [ ] Bundle size acceptable (run `npm run analyze`)
- [ ] Error boundaries catch crashes gracefully
- [ ] Loading states appear during navigation
- [ ] 404 pages are user-friendly
- [ ] Protected routes redirect unauthenticated users

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.8s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.8s |
| Cumulative Layout Shift | < 0.1 |
| First Input Delay | < 100ms |

## Common Pitfalls to Avoid

1. **Don't use `'use client'` unnecessarily** - Server Components are more performant
2. **Avoid inline functions in Server Components** - They can't be serialized
3. **Don't fetch in useEffect for initial data** - Use Server Components or `getServerSideProps`
4. **Don't ignore the App Router file conventions** - `page.tsx`, `layout.tsx`, `loading.tsx` have specific purposes
5. **Avoid large client-side bundles** - Use dynamic imports for heavy libraries
