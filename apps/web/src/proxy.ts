import { clerkMiddleware } from "@clerk/nextjs/server"

// Clerk session handling for every page and API route (Next 16 "proxy" convention).
// No route is forced to sign in: guests can use the product, and /admin checks the owner role itself.
export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
