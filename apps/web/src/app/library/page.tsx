import type { Metadata } from "next"

import { LibraryClient } from "@/components/library/library-client"
import { NOINDEX } from "@/lib/seo/metadata"

export const metadata: Metadata = { title: "My library", ...NOINDEX }

export default function LibraryPage() {
  return <LibraryClient />
}
