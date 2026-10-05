import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted-foreground">It may have moved, or the link may be mistyped. Let&apos;s get you listening instead.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Go home
        </Link>
        <Link href="/use-cases" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Browse use cases
        </Link>
      </div>
    </div>
  )
}
