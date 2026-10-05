import { SignUp } from "@clerk/nextjs"
import type { Metadata } from "next"

import { NOINDEX } from "@/lib/seo/metadata"

export const metadata: Metadata = { title: "Sign up", ...NOINDEX }

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <SignUp />
    </div>
  )
}
