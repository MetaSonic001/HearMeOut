import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google"
import { ThemeProvider } from "next-themes"

import { AnalyticsScripts } from "@/components/layout/analytics-scripts"
import { ConsentBanner } from "@/components/layout/consent-banner"
import { PageViewTracker } from "@/components/layout/page-view-tracker"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SessionProvider } from "@/components/providers/session-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SITE } from "@/lib/config"
import { JsonLd, organizationLd, softwareLd, websiteLd } from "@/lib/seo/json-ld"

import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "HearMeOut: turn any PDF or notes into audio you can learn from",
    template: "%s | HearMeOut",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "text to audiobook",
    "pdf to audio",
    "pdf to audiobook free",
    "study notes to audio",
    "hindi text to speech",
    "listen to pdf",
    "ai audiobook generator",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    title: "HearMeOut: listen to anything, learn faster",
    description: SITE.description,
    url: SITE.url,
  },
  twitter: { card: "summary_large_image", title: "HearMeOut: listen to anything, learn faster", description: SITE.description },
  alternates: { canonical: SITE.url },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#16151d" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${devanagari.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SessionProvider>
              <TooltipProvider delay={200}>
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                >
                  Skip to content
                </a>
                <SiteHeader />
                <main id="main" className="flex-1">
                  {children}
                </main>
                <SiteFooter />
                <Toaster position="top-center" richColors />
                <ConsentBanner />
                <PageViewTracker />
              </TooltipProvider>
            </SessionProvider>
          </ThemeProvider>
        </ClerkProvider>
        <JsonLd data={[organizationLd(), websiteLd(), softwareLd()]} />
        <AnalyticsScripts />
      </body>
    </html>
  )
}
