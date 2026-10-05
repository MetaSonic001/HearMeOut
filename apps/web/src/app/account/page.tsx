import type { Metadata } from "next"
import { Suspense } from "react"

import { AccountClient } from "@/components/account/account-client"
import { NOINDEX } from "@/lib/seo/metadata"

export const metadata: Metadata = { title: "Account", ...NOINDEX }

export default function AccountPage() {
  return (
    <Suspense>
      <AccountClient />
    </Suspense>
  )
}
