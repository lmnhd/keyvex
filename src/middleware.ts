import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/admin(.*)',
  '/api/analytics(.*)',
  '/api/debug(.*)',
]);

// Exclude static assets and Next.js internals
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/tests(.*)',  // Make all test pages public
  '/_next(.*)',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  // Make product-tools API routes public
  '/api/product-tools(.*)',
  // Make AI API routes public for testing and workbench functionality
  '/api/ai(.*)',
  // Make tools API public
  '/api/tools(.*)',
]);

export default clerkMiddleware((auth, req) => {
  // Skip protection for public routes and static assets
  if (isPublicRoute(req)) {
    return;
  }

  // Protect matched routes
  if (isProtectedRoute(req)) {
    try {
      auth.protect();
    } catch (error) {
      // Log auth errors but let them propagate correctly
      console.warn(`Auth protection failed for ${req.nextUrl.pathname}:`, error);
      throw error;
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files completely
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
} 